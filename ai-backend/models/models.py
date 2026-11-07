"""
SQLAlchemy ORM Models — FinAI Enterprise
"""
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Boolean, DateTime, Date, Numeric,
    Integer, Text, ForeignKey, ARRAY, JSON, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base
import enum


def gen_uuid():
    return str(uuid.uuid4())


# ─── Enums ───────────────────────────────────────────────────────────────────

class RoleName(str, enum.Enum):
    NORMAL_USER = "normal_user"
    FINANCIAL_ADVISOR = "financial_advisor"
    ADMIN = "admin"


class IncomeSource(str, enum.Enum):
    SALARY = "salary"
    FREELANCE = "freelance"
    PASSIVE = "passive"
    INVESTMENT = "investment"
    OTHER = "other"


class ExpenseCategory(str, enum.Enum):
    FOOD = "food"
    TRANSPORT = "transport"
    BILLS = "bills"
    ENTERTAINMENT = "entertainment"
    EDUCATION = "education"
    SHOPPING = "shopping"
    HEALTH = "health"
    HOUSING = "housing"
    INSURANCE = "insurance"
    OTHER = "other"


class InvestmentType(str, enum.Enum):
    STOCKS = "stocks"
    FIXED_DEPOSIT = "fixed_deposit"
    MUTUAL_FUND = "mutual_fund"
    BONDS = "bonds"
    GOLD = "gold"
    CRYPTO = "crypto"
    REAL_ESTATE = "real_estate"


class ReportFormat(str, enum.Enum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"


# ─── Models ───────────────────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    permissions = Column(JSONB, default=list)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class FamilyGroup(Base):
    __tablename__ = "family_groups"
    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                  = Column(String(200), nullable=False)
    owner_id              = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    shared_wallet_balance = Column(Numeric(15, 2), default=0)
    currency              = Column(String(10), default="LKR")
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members = relationship("User", foreign_keys="User.family_group_id", back_populates="family_group")


class User(Base):
    __tablename__ = "users"
    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email              = Column(String(255), unique=True, nullable=False)
    password_hash      = Column(String(255), nullable=False)
    first_name         = Column(String(100), nullable=False)
    last_name          = Column(String(100))
    phone              = Column(String(20))
    date_of_birth      = Column(Date)
    occupation         = Column(String(100))
    bio                = Column(Text)
    avatar_url         = Column(Text)
    currency           = Column(String(10), default="LKR")
    language           = Column(String(10), default="en")
    theme              = Column(String(10), default="dark")
    monthly_income     = Column(Numeric(15, 2))
    is_active          = Column(Boolean, default=True)
    is_verified        = Column(Boolean, default=False)
    email_verified_at  = Column(DateTime(timezone=True))
    last_login_at      = Column(DateTime(timezone=True))
    refresh_token_hash = Column(String(255))
    family_group_id    = Column(UUID(as_uuid=True), ForeignKey("family_groups.id"), nullable=True)
    advisor_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    family_group  = relationship("FamilyGroup", foreign_keys=[family_group_id], back_populates="members")
    roles         = relationship("Role", secondary="user_roles", lazy="selectin")
    income        = relationship("Income", back_populates="user", cascade="all, delete-orphan")
    expenses      = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    budgets       = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    savings_goals = relationship("SavingsGoal", back_populates="user", cascade="all, delete-orphan")
    investments   = relationship("Investment", back_populates="user", cascade="all, delete-orphan")
    ai_insights   = relationship("AIInsight", back_populates="user", cascade="all, delete-orphan")
    health_scores = relationship("HealthScore", back_populates="user", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id    = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class Income(Base):
    __tablename__ = "income"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title           = Column(String(200), nullable=False)
    amount          = Column(Numeric(15, 2), nullable=False)
    currency        = Column(String(10), default="LKR")
    source          = Column(String(50), nullable=False)
    category        = Column(String(100))
    description     = Column(Text)
    date            = Column(Date, nullable=False)
    is_recurring    = Column(Boolean, default=False)
    recurrence_type = Column(String(20))
    recurrence_end  = Column(Date)
    tags            = Column(ARRAY(String))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="income")


class Expense(Base):
    __tablename__ = "expenses"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title           = Column(String(200), nullable=False)
    amount          = Column(Numeric(15, 2), nullable=False)
    currency        = Column(String(10), default="LKR")
    category        = Column(String(50), nullable=False)
    subcategory     = Column(String(100))
    description     = Column(Text)
    date            = Column(Date, nullable=False)
    payment_method  = Column(String(50))
    merchant        = Column(String(200))
    receipt_url     = Column(Text)
    is_recurring    = Column(Boolean, default=False)
    recurrence_type = Column(String(20))
    recurrence_end  = Column(Date)
    is_shared       = Column(Boolean, default=False)
    family_group_id = Column(UUID(as_uuid=True), ForeignKey("family_groups.id"), nullable=True)
    tags            = Column(ARRAY(String))
    is_flagged      = Column(Boolean, default=False)
    fraud_score     = Column(Numeric(5, 4), default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="expenses")


class Budget(Base):
    __tablename__ = "budgets"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String(200), nullable=False)
    category        = Column(String(50), nullable=False)
    limit_amount    = Column(Numeric(15, 2), nullable=False)
    spent_amount    = Column(Numeric(15, 2), default=0)
    currency        = Column(String(10), default="LKR")
    period          = Column(String(20), nullable=False)
    start_date      = Column(Date, nullable=False)
    end_date        = Column(Date, nullable=False)
    alert_threshold = Column(Numeric(5, 2), default=80)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="budgets")


class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title           = Column(String(200), nullable=False)
    description     = Column(Text)
    target_amount   = Column(Numeric(15, 2), nullable=False)
    current_amount  = Column(Numeric(15, 2), default=0)
    currency        = Column(String(10), default="LKR")
    target_date     = Column(Date)
    category        = Column(String(50))
    icon            = Column(String(50))
    color           = Column(String(7))
    status          = Column(String(20), default="active")
    monthly_target  = Column(Numeric(15, 2))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user          = relationship("User", back_populates="savings_goals")
    contributions = relationship("SavingsContribution", back_populates="goal", cascade="all, delete-orphan")


class SavingsContribution(Base):
    __tablename__ = "savings_contributions"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id    = Column(UUID(as_uuid=True), ForeignKey("savings_goals.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount     = Column(Numeric(15, 2), nullable=False)
    note       = Column(Text)
    date       = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    goal = relationship("SavingsGoal", back_populates="contributions")


class Investment(Base):
    __tablename__ = "investments"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(200), nullable=False)
    type          = Column(String(50), nullable=False)
    symbol        = Column(String(20))
    quantity      = Column(Numeric(20, 8))
    buy_price     = Column(Numeric(15, 4), nullable=False)
    current_price = Column(Numeric(15, 4))
    currency      = Column(String(10), default="LKR")
    buy_date      = Column(Date, nullable=False)
    maturity_date = Column(Date)
    interest_rate = Column(Numeric(5, 2))
    broker        = Column(String(100))
    notes         = Column(Text)
    status        = Column(String(20), default="active")
    sell_price    = Column(Numeric(15, 4))
    sell_date     = Column(Date)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="investments")


class AIInsight(Base):
    __tablename__ = "ai_insights"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type              = Column(String(50), nullable=False)
    title             = Column(String(300), nullable=False)
    content           = Column(Text, nullable=False)
    confidence        = Column(Numeric(5, 4))
    model_used        = Column(String(100))
    prompt_tokens     = Column(Integer)
    completion_tokens = Column(Integer)
    extra_data        = Column(JSONB)  # renamed from 'metadata' (reserved by SQLAlchemy)
    is_dismissed      = Column(Boolean, default=False)
    is_acted_on       = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ai_insights")


class VoiceCommand(Base):
    __tablename__ = "voice_commands"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    raw_transcript   = Column(Text, nullable=False)
    intent           = Column(String(100))
    entities         = Column(JSONB)
    confidence       = Column(Numeric(5, 4))
    was_executed     = Column(Boolean, default=False)
    execution_result = Column(JSONB)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action          = Column(String(100), nullable=False)
    resource_type   = Column(String(50))
    resource_id     = Column(UUID(as_uuid=True))
    ip_address      = Column(INET)
    user_agent      = Column(Text)
    request_method  = Column(String(10))
    request_path    = Column(Text)
    response_status = Column(Integer)
    duration_ms     = Column(Integer)
    extra_data      = Column(JSONB)  # renamed from 'metadata' (reserved by SQLAlchemy)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class APIAnalytics(Base):
    __tablename__ = "api_analytics"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    api_key       = Column(String(255))
    endpoint      = Column(String(300), nullable=False)
    method        = Column(String(10), nullable=False)
    status_code   = Column(Integer)
    duration_ms   = Column(Integer)
    request_size  = Column(Integer)
    response_size = Column(Integer)
    ip_address    = Column(INET)
    user_agent    = Column(Text)
    error_message = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())


class HealthScore(Base):
    __tablename__ = "health_scores"
    id                       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score                    = Column(Integer, nullable=False)
    grade                    = Column(String(2))
    saving_rate_score        = Column(Integer)
    expense_ratio_score      = Column(Integer)
    budget_discipline_score  = Column(Integer)
    investment_score         = Column(Integer)
    emergency_fund_score     = Column(Integer)
    debt_score               = Column(Integer)
    breakdown                = Column(JSONB)
    recommendations          = Column(JSONB)
    calculated_at            = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="health_scores")


class Report(Base):
    __tablename__ = "reports"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title            = Column(String(200), nullable=False)
    type             = Column(String(20), nullable=False)
    format           = Column(String(10), nullable=False)
    period_start     = Column(Date, nullable=False)
    period_end       = Column(Date, nullable=False)
    file_url         = Column(Text)
    file_size_bytes  = Column(Integer)
    status           = Column(String(20), default="pending")
    extra_data       = Column(JSONB)  # renamed from 'metadata'
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String(200), nullable=False)
    message    = Column(Text, nullable=False)
    type       = Column(String(50), nullable=False)
    channel    = Column(String(20), default="push")
    is_read    = Column(Boolean, default=False)
    action_url = Column(Text)
    extra_data = Column(JSONB)  # renamed from 'metadata'
    sent_at    = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
