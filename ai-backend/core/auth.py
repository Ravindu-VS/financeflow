"""
JWT Authentication & Authorization Utilities
Simulates WSO2 Identity Server OAuth2/OIDC behavior
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import os
import json
import time
import secrets
import httpx
from cryptography import x509
from cryptography.hazmat.primitives import serialization
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


# ─── Firebase ID token verification (the PWA's identity provider) ────────────
# Tokens are RS256-signed by Google. Keys rotate; we cache them per Cache-Control.

_FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_cert_cache: dict = {"keys": {}, "expires": 0.0}


def _firebase_public_keys() -> dict:
    # Test hook: inject keys via env, only honoured when ENVIRONMENT=test
    if settings.ENVIRONMENT == "test" and os.environ.get("FIREBASE_TEST_KEYS"):
        return json.loads(os.environ["FIREBASE_TEST_KEYS"])
    now = time.time()
    if _cert_cache["keys"] and now < _cert_cache["expires"]:
        return _cert_cache["keys"]
    r = httpx.get(_FIREBASE_CERTS_URL, timeout=10)
    r.raise_for_status()
    max_age = 3600
    cc = r.headers.get("cache-control", "")
    for part in cc.split(","):
        part = part.strip()
        if part.startswith("max-age="):
            try:
                max_age = int(part.split("=", 1)[1])
            except ValueError:
                pass
    keys = {}
    for kid, pem in r.json().items():
        cert = x509.load_pem_x509_certificate(pem.encode())
        keys[kid] = cert.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
    _cert_cache.update({"keys": keys, "expires": now + max_age})
    return keys


def verify_firebase_token(token: str) -> dict:
    """Validate a Firebase Auth ID token (signature, audience, issuer, expiry, subject)."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    kid = header.get("kid")
    keys = _firebase_public_keys()
    if kid not in keys:
        _cert_cache["expires"] = 0  # keys may have rotated
        keys = _firebase_public_keys()
    if kid not in keys:
        raise HTTPException(status_code=401, detail="Unknown token key")
    project = settings.FIREBASE_PROJECT_ID
    try:
        claims = jwt.decode(
            token, keys[kid], algorithms=["RS256"], audience=project,
            issuer=f"https://securetoken.google.com/{project}",
            options={"verify_at_hash": False},
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")
    if not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid Firebase token subject")
    return claims


async def _user_from_firebase(claims: dict, db: AsyncSession) -> User:
    """Find (or provision on first call) the backend user for a Firebase account."""
    email = (claims.get("email") or f"{claims['sub']}@firebase.local").lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    name = (claims.get("name") or email.split("@")[0]).split(" ")
    user = User(
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(32)),  # unusable: login is via Firebase
        first_name=name[0][:100] or "User",
        last_name=" ".join(name[1:])[:100] or None,
        is_active=True,
        is_verified=bool(claims.get("email_verified")),
    )
    role = (await db.execute(select(Role).where(Role.name == "normal_user"))).scalar_one_or_none()
    if role:
        user.roles = [role]
    db.add(user)
    await db.flush()
    return user


# ─── Current User Dependency ──────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    # Firebase ID tokens are RS256; the backend's own (WSO2-IS style) tokens are HS256.
    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token", headers={"WWW-Authenticate": "Bearer"})
    if alg == "RS256":
        user = await _user_from_firebase(verify_firebase_token(token), db)
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User inactive")
        return user

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
