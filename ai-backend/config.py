"""
Application Configuration — FinAI Enterprise
All settings loaded from environment variables
"""
import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "FinAI Enterprise"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://finai:finai_secret@localhost:5432/finai_enterprise"

    # JWT / Auth
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # LLM Provider — 'gemini' or 'openai'
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Redis (for rate limiting / caching)
    REDIS_URL: str = "redis://localhost:6379"

    # CORS (comma-separated string or JSON list in env)
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:8080",
        "https://ravindu-vs.github.io",
    ]

    # Firebase (the PWA's identity provider). ID tokens from this project are accepted.
    FIREBASE_PROJECT_ID: str = "financeflow-a6aa0"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str) and not v.strip().startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _async_driver(cls, v: str):
        # Accept plain postgres:// URLs (Supabase/Render style) and force the asyncpg driver
        if isinstance(v, str):
            for prefix in ("postgres://", "postgresql://"):
                if v.startswith(prefix):
                    return "postgresql+asyncpg://" + v[len(prefix):]
        return v

    @property
    def is_serverless(self) -> bool:
        return bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

    # File Storage
    UPLOAD_DIR: str = "/tmp/uploads" if os.environ.get("VERCEL") else "uploads"
    REPORTS_DIR: str = "/tmp/reports" if os.environ.get("VERCEL") else "reports"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Notification (optional)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@finai-enterprise.com"

    # WSO2 Gateway
    GATEWAY_URL: str = "http://localhost:8080"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
