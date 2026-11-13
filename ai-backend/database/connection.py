"""
Database Connection — PostgreSQL with SQLAlchemy Async
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from config import settings
import logging
import ssl

logger = logging.getLogger(__name__)

_is_pooler = ":6543" in settings.DATABASE_URL or "pooler.supabase.com" in settings.DATABASE_URL
_connect_args: dict = {}
if _is_pooler:
    # Supabase Supavisor (transaction mode) does not support prepared statements
    _connect_args.update({"statement_cache_size": 0, "prepared_statement_cache_size": 0})
if "supabase" in settings.DATABASE_URL or "sslmode=require" in settings.DATABASE_URL:
    _connect_args["ssl"] = ssl.create_default_context()

_url = settings.DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")

if settings.is_serverless:
    # One short-lived function instance per request: no pooling, the pooler does it.
    engine = create_async_engine(_url, echo=settings.DEBUG, poolclass=NullPool, connect_args=_connect_args)
else:
    engine = create_async_engine(
        _url,
        echo=settings.DEBUG,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=_connect_args,
    )

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency — provides a database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
