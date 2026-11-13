"""
Firestore → PostgreSQL sync.

The PWA's system of record is Firestore. The client pushes its period-window of transactions,
goals and holdings here (authenticated with its Firebase ID token through the gateway); rows are
upserted by `external_id` (the Firestore document id). Rows of this user that are inside the
synced date window but no longer exist in Firestore are removed, so deletes propagate too.

Income/expense transactions are also mirrored into the `income` / `expenses` tables that the
AI, health-score, prediction, fraud and report services read — so they work on real data.
"""
from datetime import date, datetime, timezone
from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_active_user
from database.connection import get_db
from models.models import User

router = APIRouter()

TxType = Literal['income', 'expense', 'transfer', 'investment', 'withdrawal', 'savings_contribution',
                 'savings_withdrawal', 'refund', 'reimbursement', 'adjustment']


class SyncTransaction(BaseModel):
    id: str = Field(..., min_length=1, max_length=200)
    type: TxType
    amount: float
    currency: str = 'LKR'
    baseAmount: Optional[float] = None
    date: date
    category: Optional[str] = Field(None, max_length=64)
    subcategory: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    merchant: Optional[str] = Field(None, max_length=200)
    paymentMethod: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None
    kind: Optional[str] = None
    status: Literal['cleared', 'pending', 'void'] = 'cleared'
    source: str = 'manual'
    recurrenceId: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def _bounded(cls, v):
        if abs(v) >= 1e9:
            raise ValueError('amount out of range')
        return v


class SyncGoal(BaseModel):
    id: str
    name: str = Field(..., max_length=200)
    targetAmount: float
    currentAmount: float = 0
    targetDate: Optional[date] = None
    status: Optional[str] = 'active'


class SyncHolding(BaseModel):
    id: str
    name: str = Field(..., max_length=200)
    type: str = 'other'
    amount: float
    currentValue: Optional[float] = None
    purchaseDate: Optional[date] = None
    status: Optional[str] = 'active'


class SyncRequest(BaseModel):
    since: date
    until: date
    transactions: List[SyncTransaction] = Field(default_factory=list, max_length=20000)
    goals: List[SyncGoal] = Field(default_factory=list, max_length=500)
    holdings: List[SyncHolding] = Field(default_factory=list, max_length=1000)


KIND_MAP = {'one_time': 'one_time', 'regular': 'regular', 'unexpected': 'unexpected', 'emergency': 'emergency'}
SOURCES = {'manual', 'voice', 'imported', 'api', 'bank_sync', 'ai', 'recurring', 'migration'}


@router.post("/firestore")
async def sync_from_firestore(req: SyncRequest, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    if req.until < req.since:
        raise HTTPException(status_code=422, detail="until must be >= since")
    uid = user.id
    txs = [t for t in req.transactions if req.since <= t.date <= req.until]
    ids = [t.id for t in txs]

    for t in txs:
        amt = round(abs(t.baseAmount if t.baseAmount is not None else t.amount), 2)
        if t.type == 'adjustment':
            amt = round(t.baseAmount if t.baseAmount is not None else t.amount, 2)
        params = {
            'uid': uid, 'ext': t.id, 'type': t.type, 'amount': amt if amt != 0 else 0.01, 'currency': t.currency[:10],
            'date': t.date, 'category': t.category, 'subcategory': t.subcategory, 'description': t.description,
            'merchant': t.merchant, 'pm': t.paymentMethod, 'tags': t.tags, 'kind': KIND_MAP.get(t.kind or ''),
            'status': t.status, 'source': t.source if t.source in SOURCES else 'api',
            'title': (t.description or t.merchant or t.category or t.type)[:200],
        }
        if t.type == 'adjustment' and params['amount'] == 0:
            continue
        await db.execute(text("""
            INSERT INTO transactions (user_id, external_id, type, amount, currency, date, category, subcategory,
                description, merchant, payment_method, tags, kind, status, source)
            VALUES (:uid, :ext, :type, :amount, :currency, :date, :category, :subcategory, :description, :merchant,
                :pm, :tags, :kind, :status, :source)
            ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                type = EXCLUDED.type, amount = EXCLUDED.amount, currency = EXCLUDED.currency, date = EXCLUDED.date,
                category = EXCLUDED.category, subcategory = EXCLUDED.subcategory, description = EXCLUDED.description,
                merchant = EXCLUDED.merchant, payment_method = EXCLUDED.payment_method, tags = EXCLUDED.tags,
                kind = EXCLUDED.kind, status = EXCLUDED.status, source = EXCLUDED.source, updated_at = NOW()
        """), params)
        if t.status == 'void':
            continue
        if t.type == 'income':
            await db.execute(text("""
                INSERT INTO income (user_id, external_id, title, amount, currency, source, category, description, date, is_recurring, tags)
                VALUES (:uid, :ext, :title, :amount, :currency, :category, :category, :description, :date, :rec, :tags)
                ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                    title = EXCLUDED.title, amount = EXCLUDED.amount, source = EXCLUDED.source, category = EXCLUDED.category,
                    description = EXCLUDED.description, date = EXCLUDED.date, is_recurring = EXCLUDED.is_recurring, updated_at = NOW()
            """), {**params, 'category': t.category or 'other_income', 'rec': bool(t.recurrenceId)})
        elif t.type == 'expense':
            await db.execute(text("""
                INSERT INTO expenses (user_id, external_id, title, amount, currency, category, subcategory, description, date,
                    payment_method, merchant, is_recurring, tags)
                VALUES (:uid, :ext, :title, :amount, :currency, :category, :subcategory, :description, :date, :pm, :merchant, :rec, :tags)
                ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                    title = EXCLUDED.title, amount = EXCLUDED.amount, category = EXCLUDED.category, subcategory = EXCLUDED.subcategory,
                    description = EXCLUDED.description, date = EXCLUDED.date, payment_method = EXCLUDED.payment_method,
                    merchant = EXCLUDED.merchant, is_recurring = EXCLUDED.is_recurring, updated_at = NOW()
            """), {**params, 'category': t.category or 'other', 'rec': bool(t.recurrenceId)})

    # Remove rows deleted/voided in Firestore within the synced window
    keep = ids or ['__none__']
    removed = 0
    for table in ('transactions', 'income', 'expenses'):
        r = await db.execute(text(f"""
            DELETE FROM {table} WHERE user_id = :uid AND external_id IS NOT NULL
              AND date BETWEEN :since AND :until AND NOT (external_id = ANY(:keep))
        """), {'uid': uid, 'since': req.since, 'until': req.until, 'keep': keep})
        removed += r.rowcount or 0
    voided = [t.id for t in txs if t.status == 'void']
    if voided:
        for table in ('income', 'expenses'):
            await db.execute(text(f"DELETE FROM {table} WHERE user_id = :uid AND external_id = ANY(:ids)"), {'uid': uid, 'ids': voided})

    for g in req.goals:
        if g.targetAmount <= 0:
            continue
        await db.execute(text("""
            INSERT INTO savings_goals (user_id, external_id, title, target_amount, current_amount, target_date, status)
            VALUES (:uid, :ext, :title, :target, :current, :td, :status)
            ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                title = EXCLUDED.title, target_amount = EXCLUDED.target_amount, current_amount = EXCLUDED.current_amount,
                target_date = EXCLUDED.target_date, status = EXCLUDED.status, updated_at = NOW()
        """), {'uid': uid, 'ext': g.id, 'title': g.name[:200], 'target': g.targetAmount, 'current': g.currentAmount,
               'td': g.targetDate, 'status': (g.status or 'active')[:20]})

    for h in req.holdings:
        if h.amount <= 0:
            continue
        cur = h.currentValue if h.currentValue is not None else h.amount
        await db.execute(text("""
            INSERT INTO investments (user_id, external_id, name, type, quantity, buy_price, current_price, buy_date, status)
            VALUES (:uid, :ext, :name, :type, 1, :buy, :cur, :bd, :status)
            ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                name = EXCLUDED.name, type = EXCLUDED.type, buy_price = EXCLUDED.buy_price,
                current_price = EXCLUDED.current_price, buy_date = EXCLUDED.buy_date, status = EXCLUDED.status, updated_at = NOW()
        """), {'uid': uid, 'ext': h.id, 'name': h.name[:200], 'type': h.type[:50], 'buy': h.amount, 'cur': cur,
               'bd': h.purchaseDate or date.today(), 'status': (h.status or 'active')[:20]})

    await db.execute(text("UPDATE users SET last_synced_at = NOW() WHERE id = :uid"), {'uid': uid})
    return {
        'synced': {'transactions': len(txs), 'goals': len(req.goals), 'holdings': len(req.holdings)},
        'removed': removed,
        'window': {'since': str(req.since), 'until': str(req.until)},
        'at': datetime.now(timezone.utc).isoformat(),
    }


@router.get("/status")
async def sync_status(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT (SELECT COUNT(*) FROM transactions WHERE user_id = :uid) AS transactions,
               (SELECT last_synced_at FROM users WHERE id = :uid) AS last_synced_at
    """), {'uid': user.id})
    row = r.mappings().first()
    return {'transactions': row['transactions'], 'last_synced_at': row['last_synced_at']}
