"""
JWT Authentication & Authorization Utilities
Simulates WSO2 Identity Server OAuth2/OIDC behavior
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import User, Role
from database.connection import get_db
from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ─── Password Utilities ───────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── Token Creation (WSO2 IS style) ──────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token (mimics WSO2 IS JWT profile)"""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "https://localhost:9443/oauth2/token",  # WSO2 IS issuer
        "aud": "finai-enterprise-api",
        "token_type": "access_token"
    })
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "token_type": "refresh_token"
    })
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_id_token(user: User) -> str:
    """Create OpenID Connect ID token (WSO2 IS OIDC pattern)"""
    roles = [r.name for r in user.roles] if user.roles else ["normal_user"]
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "given_name": user.first_name,
        "family_name": user.last_name or "",
        "preferred_username": user.email,
        "roles": roles,
        "iss": "https://localhost:9443/oauth2/token",
        "aud": "finai-enterprise-frontend",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
        "token_type": "id_token"
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ─── Token Verification ───────────────────────────────────────────────────────

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )


# ─── Current User Dependency ──────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


# ─── RBAC Permission Checker ──────────────────────────────────────────────────

def require_roles(*required_roles: str):
    """
    Decorator-style dependency factory for role-based access control.
    Mimics WSO2 API Manager scope validation.
    """
    async def check_roles(current_user: User = Depends(get_current_active_user)) -> User:
        user_role_names = {r.name for r in current_user.roles}
        if not user_role_names.intersection(set(required_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(required_roles)}"
            )
        return current_user
    return check_roles


def require_advisor(current_user: User = Depends(get_current_active_user)) -> User:
    user_role_names = {r.name for r in current_user.roles}
    if "financial_advisor" not in user_role_names and "admin" not in user_role_names:
        raise HTTPException(
            status_code=403,
            detail="Financial Advisor or Admin role required"
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    user_role_names = {r.name for r in current_user.roles}
    if "admin" not in user_role_names:
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user
