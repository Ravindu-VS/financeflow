"""
Auth Router — WSO2 Identity Server OAuth2/OIDC Simulation
Issues access_token, refresh_token, and id_token
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone

from models.models import User, Role, UserRole
from database.connection import get_db
from core.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, create_id_token,
    decode_token, get_current_active_user
)

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: Optional[str] = None
    role: Optional[str] = "normal_user"  # 'normal_user' or 'financial_advisor'


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    id_token: str
    token_type: str = "Bearer"
    expires_in: int = 1800  # 30 minutes
    scope: str = "openid profile email"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register new user — WSO2 IS user provisioning"""
    # Check existing user
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Get role
    role_name = request.role if request.role in ["normal_user", "financial_advisor"] else "normal_user"
    role_result = await db.execute(select(Role).where(Role.name == role_name))
    role = role_result.scalar_one_or_none()
    
    if not role:
        # Create role if missing
        role = Role(name=role_name, description=f"{role_name.replace('_', ' ').title()} role")
        db.add(role)
        await db.flush()

    # Create user
    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        last_login_at=datetime.now(timezone.utc)
    )
    db.add(user)
    await db.flush()

    # Assign role
    user_role = UserRole(user_id=user.id, role_id=role.id)
    db.add(user_role)
    await db.commit()
    await db.refresh(user)

    # Load roles for token
    role_result = await db.execute(select(Role).where(Role.name == role_name))
    user_role_obj = role_result.scalar_one_or_none()
    user.roles = [user_role_obj] if user_role_obj else []

    return _issue_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user — WSO2 IS Resource Owner Password flow"""
    result = await db.execute(select(User).where(User.email == request.email, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token"""
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("token_type") != "refresh_token":
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        await db.refresh(user)
        return _issue_tokens(user)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Get current user profile"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "avatar_url": current_user.avatar_url,
        "currency": current_user.currency,
        "language": current_user.language,
        "theme": current_user.theme,
        "monthly_income": float(current_user.monthly_income) if current_user.monthly_income else None,
        "roles": [r.name for r in current_user.roles],
        "is_advisor": any(r.name in ("financial_advisor", "admin") for r in current_user.roles),
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at.isoformat()
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """Invalidate session (client-side token deletion)"""
    # In production, add token to blacklist in Redis
    return {"message": "Logged out successfully", "user": current_user.email}


def _issue_tokens(user: User) -> dict:
    """Issue complete OAuth2/OIDC token set"""
    roles = [r.name for r in user.roles] if user.roles else ["normal_user"]
    
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "roles": roles,
        "given_name": user.first_name
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    id_token = create_id_token(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "id_token": id_token,
        "token_type": "Bearer",
        "expires_in": 1800,
        "scope": "openid profile email",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name or "",
            "avatar_url": user.avatar_url,
            "currency": user.currency,
            "theme": user.theme,
            "roles": roles,
            "is_advisor": "financial_advisor" in roles
        }
    }
