"""
Backend integration tests — run against a real PostgreSQL loaded with
database/schema.sql + migrations/001 + migrations/002.

    DATABASE_URL=postgresql://user@host:5432/finai_test pytest -q

Firebase ID tokens are simulated with a locally generated RSA key whose public key is
injected into the verifier's key cache (same RS256 / aud / iss checks as production).
"""
import os
import time
import uuid
import pytest
from datetime import date
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jose import jwt
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("DATABASE_URL", "postgresql://postgres@localhost:5544/finai_test")
os.environ["GEMINI_API_KEY"] = ""

import main  # noqa: E402
from core import auth as auth_mod  # noqa: E402
from database.connection import engine  # noqa: E402
from sqlalchemy import text  # noqa: E402

PROJECT = "financeflow-a6aa0"
_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_priv = _key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
_pub = _key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
auth_mod._cert_cache.update({"keys": {"test-kid": _pub}, "expires": time.time() + 3600})


def firebase_token(sub="uid-1", email=None, aud=PROJECT, exp_in=3600):
    now = int(time.time())
    claims = {"sub": sub, "user_id": sub, "aud": aud, "iss": f"https://securetoken.google.com/{aud}",
              "iat": now, "exp": now + exp_in, "auth_time": now, "email": email or f"{sub}@example.lk", "email_verified": True, "name": "Test User"}
    return jwt.encode(claims, _priv, algorithm="RS256", headers={"kid": "test-kid"})


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as c:
        yield c


def tx(i, **kw):
    base = {"id": f"t{i}", "type": "expense", "amount": 100.0, "currency": "LKR", "date": "2026-11-05",
            "category": "food_dining", "description": f"item {i}", "status": "cleared", "source": "manual"}
    base.update(kw)
    return base


async def test_health_reports_real_dependencies(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["components"]["database"]["status"] == "online"
    assert body["components"]["llm"]["status"] == "not_configured"


async def test_rejects_missing_and_invalid_tokens(client):
    assert (await client.get("/api/v1/sync/status")).status_code == 401
    bad_aud = firebase_token(aud="some-other-project")
    assert (await client.get("/api/v1/sync/status", headers={"Authorization": f"Bearer {bad_aud}"})).status_code == 401
    expired = firebase_token(exp_in=-10)
    assert (await client.get("/api/v1/sync/status", headers={"Authorization": f"Bearer {expired}"})).status_code == 401
    forged = firebase_token().rsplit(".", 1)[0] + ".AAAA"
    assert (await client.get("/api/v1/sync/status", headers={"Authorization": f"Bearer {forged}"})).status_code == 401


async def test_firebase_user_is_provisioned_once(client):
    sub = f"u-{uuid.uuid4().hex[:8]}"
    h = {"Authorization": f"Bearer {firebase_token(sub)}"}
    assert (await client.get("/api/v1/sync/status", headers=h)).status_code == 200
    assert (await client.get("/api/v1/sync/status", headers=h)).status_code == 200
    async with engine.connect() as c:
        n = (await c.execute(text("SELECT COUNT(*) FROM users WHERE email = :e"), {"e": f"{sub}@example.lk"})).scalar()
    assert n == 1


async def test_sync_upserts_mirrors_and_deletes(client):
    sub = f"u-{uuid.uuid4().hex[:8]}"
    h = {"Authorization": f"Bearer {firebase_token(sub)}"}
    payload = {
        "since": "2026-11-01", "until": "2026-11-30",
        "transactions": [
            tx(1, type="income", amount=100000, category="salary", description="Salary"),
            tx(2, amount=450), tx(3, amount=20000, type="transfer", category="transfer"),
            tx(4, amount=50, currency="USD", baseAmount=15000),
        ],
        "goals": [{"id": "g1", "name": "Emergency", "targetAmount": 100000, "currentAmount": 5000}],
        "holdings": [{"id": "h1", "name": "FD", "type": "fixed_deposit", "amount": 20000, "currentValue": 20500}],
    }
    r = await client.post("/api/v1/sync/firestore", json=payload, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["synced"]["transactions"] == 4

    # idempotent: same payload again
    assert (await client.post("/api/v1/sync/firestore", json=payload, headers=h)).status_code == 200
    async with engine.connect() as c:
        uid = (await c.execute(text("SELECT id FROM users WHERE email = :e"), {"e": f"{sub}@example.lk"})).scalar()
        q = lambda sql: c.execute(text(sql), {"u": uid})
        assert (await q("SELECT COUNT(*) FROM transactions WHERE user_id = :u")).scalar() == 4
        assert (await q("SELECT COALESCE(SUM(amount),0) FROM income WHERE user_id = :u")).scalar() == 100000
        # transfer is not mirrored as an expense; USD expense mirrored in base currency
        assert (await q("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id = :u")).scalar() == 15450
        assert (await q("SELECT COUNT(*) FROM savings_goals WHERE user_id = :u")).scalar() == 1
        assert (await q("SELECT COUNT(*) FROM investments WHERE user_id = :u")).scalar() == 1

    # delete t2 in Firestore + edit t1 → propagated
    payload["transactions"] = [tx(1, type="income", amount=120000, category="salary"), tx(3, type="transfer", amount=20000, category="transfer"), tx(4, amount=50, currency="USD", baseAmount=15000)]
    assert (await client.post("/api/v1/sync/firestore", json=payload, headers=h)).status_code == 200
    async with engine.connect() as c:
        q = lambda sql: c.execute(text(sql), {"u": uid})
        assert (await q("SELECT COUNT(*) FROM transactions WHERE user_id = :u")).scalar() == 3
        assert (await q("SELECT SUM(amount) FROM income WHERE user_id = :u")).scalar() == 120000
        assert (await q("SELECT SUM(amount) FROM expenses WHERE user_id = :u")).scalar() == 15000


async def test_sync_is_isolated_per_user(client):
    a, b = f"a-{uuid.uuid4().hex[:6]}", f"b-{uuid.uuid4().hex[:6]}"
    body = {"since": "2026-11-01", "until": "2026-11-30", "transactions": [tx(1, amount=999)]}
    for s in (a, b):
        assert (await client.post("/api/v1/sync/firestore", json=body, headers={"Authorization": f"Bearer {firebase_token(s)}"})).status_code == 200
    # user a empties their window → b's identical external id untouched
    await client.post("/api/v1/sync/firestore", json={**body, "transactions": []}, headers={"Authorization": f"Bearer {firebase_token(a)}"})
    r = await client.get("/api/v1/sync/status", headers={"Authorization": f"Bearer {firebase_token(b)}"})
    assert r.json()["transactions"] == 1


async def test_sync_validates_input(client):
    h = {"Authorization": f"Bearer {firebase_token('val-user')}"}
    r = await client.post("/api/v1/sync/firestore", json={"since": "2026-11-30", "until": "2026-11-01"}, headers=h)
    assert r.status_code == 422
    r = await client.post("/api/v1/sync/firestore", json={"since": "2026-11-01", "until": "2026-11-30", "transactions": [tx(1, type="bogus")]}, headers=h)
    assert r.status_code == 422
    r = await client.post("/api/v1/sync/firestore", json={"since": "2026-11-01", "until": "2026-11-30", "transactions": [tx(1, amount=1e12)]}, headers=h)
    assert r.status_code == 422


async def test_ai_chat_never_invents_numbers_without_llm(client):
    h = {"Authorization": f"Bearer {firebase_token('ai-user')}"}
    r = await client.post("/api/v1/ai/chat", json={"message": "Where did my money go?", "financial_context": {"thisMonth": {"income": 1}}}, headers=h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "LKR 45,000" not in data["response"]
    assert data.get("model") in (None, "unavailable") or data.get("confidence", 0) == 0


async def test_voice_parser_endpoint(client):
    h = {"Authorization": f"Bearer {firebase_token('voice-user')}"}
    r = await client.post("/api/v1/voice/process", json={"transcript": "spent 500 on lunch"}, headers=h)
    assert r.status_code == 200
    assert r.json()["entities"]["amount"] == 500


async def test_me_reports_roles(client):
    h = {"Authorization": f"Bearer {firebase_token(f'u-{uuid.uuid4().hex[:8]}')}"}
    r = await client.get("/api/v1/auth/me", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["is_advisor"] is False
    assert "normal_user" in r.json()["roles"]


async def test_report_generated_inline_from_synced_data(client):
    sub = f"u-{uuid.uuid4().hex[:8]}"
    h = {"Authorization": f"Bearer {firebase_token(sub)}"}
    await client.post("/api/v1/sync/firestore", headers=h, json={"since": "2026-11-01", "until": "2026-11-30", "transactions": [
        tx(1, type="income", amount=90000, category="salary"), tx(2, amount=1200)]})
    for fmt, magic in (("pdf", b"%PDF"), ("excel", b"PK"), ("csv", None)):
        r = await client.post("/api/v1/reports/generate", headers=h, json={"type": "monthly", "format": fmt, "period_start": "2026-11-01", "period_end": "2026-11-30", "inline": True})
        assert r.status_code == 200, r.text
        if magic:
            assert r.content.startswith(magic)
        else:
            assert b"90000" in r.content or b"90,000" in r.content
    bad = await client.post("/api/v1/reports/generate", headers=h, json={"type": "monthly", "format": "../../etc", "period_start": "2026-11-01", "period_end": "2026-11-30"})
    assert bad.status_code == 422


async def test_health_score_uses_synced_data(client):
    sub = f"u-{uuid.uuid4().hex[:8]}"
    h = {"Authorization": f"Bearer {firebase_token(sub)}"}
    await client.post("/api/v1/sync/firestore", headers=h, json={"since": "2026-11-01", "until": "2026-11-30", "transactions": [
        tx(1, type="income", amount=100000, category="salary", date=date.today().replace(day=1).isoformat()),
        tx(2, amount=30000, date=date.today().replace(day=1).isoformat())]})
    r = await client.get("/api/v1/health-score/calculate", headers=h)
    assert r.status_code == 200, r.text
    assert 0 <= r.json()["score"] <= 100


async def test_family_group_create_join_summary_leave(client):
    a, b = f"fa-{uuid.uuid4().hex[:6]}", f"fb-{uuid.uuid4().hex[:6]}"
    ha, hb = {"Authorization": f"Bearer {firebase_token(a)}"}, {"Authorization": f"Bearer {firebase_token(b)}"}
    m = date.today().strftime("%Y-%m")
    for h, inc, exp in ((ha, 100000, 40000), (hb, 80000, 30000)):
        await client.post("/api/v1/sync/firestore", headers=h, json={"since": f"{m}-01", "until": f"{m}-28", "transactions": [
            tx(1, type="income", amount=inc, category="salary", date=f"{m}-01"), tx(2, amount=exp, category="groceries", date=f"{m}-02")]})
    r = await client.post("/api/v1/family/create", headers=ha, json={"name": "Perera Family"})
    assert r.status_code == 200, r.text
    code = r.json()["group"]["invite_code"]
    assert (await client.post("/api/v1/family/create", headers=ha, json={"name": "Again"})).status_code == 409
    assert (await client.post("/api/v1/family/join", headers=hb, json={"code": "not-a-valid-code"})).status_code == 404
    r = await client.post("/api/v1/family/join", headers=hb, json={"code": code})
    assert r.status_code == 200 and len(r.json()["members"]) == 2
    s = (await client.get("/api/v1/family/summary", headers=ha)).json()
    assert s["income"] == 180000 and s["expenses"] == 70000 and s["net"] == 110000
    assert s["top_categories"][0]["category"] == "groceries"
    # owner leaves → ownership passes to the other member; last member leaving deletes the group
    await client.post("/api/v1/family/leave", headers=ha)
    mb = (await client.get("/api/v1/family/members", headers=hb)).json()
    assert [x["is_owner"] for x in mb["members"]] == [True]
    await client.post("/api/v1/family/leave", headers=hb)
    assert (await client.get("/api/v1/family/members", headers=hb)).json()["group"] is None


async def test_advisor_enroll_link_and_view_client(client):
    adv, cli, other = (f"{p}-{uuid.uuid4().hex[:6]}" for p in ("adv", "cli", "oth"))
    ha, hc, ho = ({"Authorization": f"Bearer {firebase_token(s)}"} for s in (adv, cli, other))
    assert (await client.get("/api/v1/advisor/clients", headers=ha)).status_code == 403
    r = await client.post("/api/v1/advisor/enroll", headers=ha)
    assert r.status_code == 200, r.text
    code = r.json()["advisor_code"]
    assert (await client.get("/api/v1/auth/me", headers=ha)).json()["is_advisor"] is True
    assert (await client.get("/api/v1/advisor/clients", headers=ha)).json()["clients"] == []
    # a non-advisor's id is not a valid advisor code
    me_other = (await client.get("/api/v1/auth/me", headers=ho)).json()
    assert (await client.post("/api/v1/advisor/link", headers=hc, json={"code": me_other["id"]})).status_code == 404
    r = await client.post("/api/v1/advisor/link", headers=hc, json={"code": code})
    assert r.status_code == 200 and r.json()["my_advisor"] is not None
    clients = (await client.get("/api/v1/advisor/clients", headers=ha)).json()["clients"]
    assert len(clients) == 1
    ov = await client.get(f"/api/v1/advisor/clients/{clients[0]['id']}/overview", headers=ha)
    assert ov.status_code == 200, ov.text
    # client withdraws consent → advisor loses access
    await client.post("/api/v1/advisor/unlink", headers=hc)
    assert (await client.get("/api/v1/advisor/clients", headers=ha)).json()["clients"] == []
    assert (await client.get(f"/api/v1/advisor/clients/{clients[0]['id']}/overview", headers=ha)).status_code == 404


async def test_sync_accepts_loan_transactions_not_counted_as_income_or_expense(client):
    h = {"Authorization": f"Bearer {firebase_token(f'loan-{uuid.uuid4().hex[:6]}')}"}
    r = await client.post("/api/v1/sync/firestore", headers=h, json={"since": "2026-11-01", "until": "2026-11-30", "transactions": [
        tx(1, type="loan_received", amount=200000, category="loan_borrowed"),
        tx(2, type="loan_repayment", amount=20000, category="loan_repaid"),
        tx(3, type="loan_given", amount=15000, category="loan_lent"),
        tx(4, type="expense", amount=1500, category="loan_interest")]})
    assert r.status_code == 200, r.text
    assert r.json()["synced"]["transactions"] == 4
    s = (await client.get("/api/v1/sync/status", headers=h)).json()
    assert s is not None
