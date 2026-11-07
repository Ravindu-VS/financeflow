"""
Voice Assistant Router — NLP Intent Detection & Entity Extraction
Processes speech transcripts for financial commands
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import re
from datetime import date

from models.models import User, VoiceCommand
from database.connection import get_db
from core.auth import get_current_active_user

router = APIRouter()


class VoiceInput(BaseModel):
    transcript: str
    language: Optional[str] = "en"


class VoiceResult(BaseModel):
    intent: str
    confidence: float
    entities: dict
    suggested_action: str
    form_data: dict
    raw_transcript: str


# ─── Intent Patterns ─────────────────────────────────────────────────────────

INTENT_PATTERNS = {
    "add_expense": [
        r"(?:add|record|log|spent|spend|paid|pay|bought|buy)\s+(?:expense|payment|bill)?",
        r"(?:expense|spent)\s+(?:of\s+)?\d",
        r"\d+\s+(?:rupees?|rs|lkr|usd|dollars?)\s+(?:for|on)",
    ],
    "add_income": [
        r"(?:add|record|got|received|earned|get)\s+(?:income|salary|payment|money)",
        r"(?:salary|income|freelance|earned)\s+(?:of\s+)?\d",
    ],
    "add_investment": [
        r"(?:invest|bought|buy|purchase)\s+(?:stocks?|shares?|crypto|bitcoin|gold|fd|fixed)",
        r"(?:invest|investment)\s+(?:of\s+)?\d",
    ],
    "add_savings": [
        r"(?:save|saved|add|put)\s+(?:to\s+)?(?:savings?|emergency|fund|goal)",
    ],
    "query_balance": [
        r"(?:how much|what is|what's|show|tell me)\s+(?:my\s+)?(?:balance|total|spending|expenses?|income)",
        r"(?:my\s+)?(?:balance|financial\s+health|spending\s+summary)",
    ],
    "query_budget": [
        r"(?:how much|what is|remaining|left)\s+(?:in\s+)?(?:my\s+)?budget",
        r"budget\s+(?:remaining|left|status)",
    ],
    "query_savings": [
        r"(?:savings?|emergency fund|goal)\s+(?:progress|status|how much)",
        r"how much\s+(?:have i\s+)?saved",
    ],
}

CATEGORY_KEYWORDS = {
    "food": ["food", "lunch", "dinner", "breakfast", "restaurant", "coffee", "meal", "eat", "grocery", "groceries", "dining"],
    "transport": ["transport", "bus", "taxi", "uber", "fuel", "petrol", "gas", "train", "fare", "commute", "ride"],
    "bills": ["bill", "electricity", "water", "internet", "phone", "subscription", "utility", "utilities"],
    "entertainment": ["movie", "cinema", "netflix", "spotify", "game", "entertainment", "fun", "concert"],
    "education": ["book", "course", "tuition", "school", "university", "education", "class", "lesson"],
    "shopping": ["shopping", "clothes", "shoes", "amazon", "mall", "store", "buy", "purchase"],
    "health": ["doctor", "medicine", "pharmacy", "hospital", "health", "medical", "clinic"],
    "housing": ["rent", "house", "apartment", "maintenance", "repair", "home"],
}

INCOME_SOURCE_KEYWORDS = {
    "salary": ["salary", "paycheck", "monthly pay", "wage"],
    "freelance": ["freelance", "project", "gig", "contract", "client"],
    "passive": ["dividend", "interest", "passive", "rental income"],
    "investment": ["profit", "return", "gain", "investment return"],
}

INVESTMENT_TYPE_KEYWORDS = {
    "stocks": ["stock", "share", "equity", "cse"],
    "crypto": ["crypto", "bitcoin", "ethereum", "btc", "eth"],
    "fixed_deposit": ["fd", "fixed deposit", "savings account"],
    "gold": ["gold", "sovereign"],
    "mutual_fund": ["mutual fund", "unit trust", "fund"],
}


def _extract_amount(text: str) -> Optional[float]:
    """Extract monetary amount from text"""
    # Match patterns like: 500, 1000.50, 1,000, Rs 500, LKR 500, $100
    patterns = [
        r'(?:rs\.?|lkr|usd|\$|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)',
        r'(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|lkr|usd|dollars?)',
        r'(\d+(?:,\d{3})*(?:\.\d{1,2})?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                return float(amount_str)
            except ValueError:
                continue
    return None


def _extract_category(text: str) -> Optional[str]:
    """Extract expense category from text"""
    text_lower = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return category
    return "other"


def _extract_income_source(text: str) -> str:
    text_lower = text.lower()
    for source, keywords in INCOME_SOURCE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return source
    return "other"


def _extract_investment_type(text: str) -> str:
    text_lower = text.lower()
    for inv_type, keywords in INVESTMENT_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return inv_type
    return "stocks"


def _extract_description(text: str) -> str:
    """Extract what the expense was for"""
    for_match = re.search(r'(?:for|on)\s+([a-zA-Z\s]+?)(?:\s+(?:today|yesterday|this week|last week|\d)|\s*$)', text, re.IGNORECASE)
    if for_match:
        return for_match.group(1).strip()
    return ""


def _detect_intent(text: str) -> tuple[str, float]:
    """Detect intent from transcript"""
    text_lower = text.lower()
    scores: dict = {}
    
    for intent, patterns in INTENT_PATTERNS.items():
        score = 0
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                score += 1
        if score > 0:
            scores[intent] = score / len(patterns)
    
    if not scores:
        return "unknown", 0.0
    
    best_intent = max(scores, key=scores.get)
    confidence = min(0.95, scores[best_intent] + 0.5)
    return best_intent, confidence


def _build_form_data(intent: str, entities: dict) -> dict:
    """Build pre-filled form data for the frontend"""
    if intent == "add_expense":
        return {
            "amount": entities.get("amount"),
            "category": entities.get("category", "other"),
            "description": entities.get("description", ""),
            "date": str(date.today()),
            "title": entities.get("description", "Voice Entry")
        }
    elif intent == "add_income":
        return {
            "amount": entities.get("amount"),
            "source": entities.get("income_source", "other"),
            "description": entities.get("description", ""),
            "date": str(date.today()),
            "title": entities.get("description", "Voice Entry")
        }
    elif intent == "add_investment":
        return {
            "amount": entities.get("amount"),
            "type": entities.get("investment_type", "stocks"),
            "date": str(date.today()),
            "name": entities.get("description", "Voice Entry")
        }
    return {}


@router.post("/process", response_model=VoiceResult)
async def process_voice_command(
    voice_input: VoiceInput,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Process voice transcript — extract intent and entities.
    
    Example inputs:
    - "Add expense 500 rupees for lunch"
    - "Add salary income 75000"
    - "Invest 10000 in fixed deposit"
    - "How much did I spend this week?"
    """
    text = voice_input.transcript.strip()
    
    # Detect intent
    intent, confidence = _detect_intent(text)
    
    # Extract entities
    amount = _extract_amount(text)
    category = _extract_category(text)
    description = _extract_description(text)
    income_source = _extract_income_source(text)
    investment_type = _extract_investment_type(text)
    
    entities = {
        "amount": amount,
        "category": category,
        "description": description,
        "income_source": income_source,
        "investment_type": investment_type,
        "date": str(date.today())
    }
    
    # Build suggested action and form data
    action_map = {
        "add_expense": f"Open expense form with LKR {amount} in {category}",
        "add_income": f"Open income form with LKR {amount} from {income_source}",
        "add_investment": f"Open investment form with LKR {amount} in {investment_type}",
        "add_savings": f"Open savings form with LKR {amount}",
        "query_balance": "Show financial summary dashboard",
        "query_budget": "Show budget overview",
        "query_savings": "Show savings goals progress",
        "unknown": "Could not understand command — please try again"
    }
    
    suggested_action = action_map.get(intent, "Unknown command")
    form_data = _build_form_data(intent, entities)
    
    # Save command to DB
    voice_cmd = VoiceCommand(
        user_id=current_user.id,
        raw_transcript=text,
        intent=intent,
        entities=entities,
        confidence=confidence,
        was_executed=False
    )
    db.add(voice_cmd)
    await db.commit()
    
    return VoiceResult(
        intent=intent,
        confidence=round(confidence, 3),
        entities=entities,
        suggested_action=suggested_action,
        form_data=form_data,
        raw_transcript=text
    )


@router.get("/history")
async def get_voice_history(
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get recent voice command history"""
    from sqlalchemy import desc
    result = await db.execute(
        select(VoiceCommand)
        .where(VoiceCommand.user_id == current_user.id)
        .order_by(desc(VoiceCommand.created_at))
        .limit(limit)
    )
    commands = result.scalars().all()
    
    return {
        "commands": [
            {
                "id": str(c.id),
                "transcript": c.raw_transcript,
                "intent": c.intent,
                "confidence": float(c.confidence) if c.confidence else 0,
                "was_executed": c.was_executed,
                "created_at": c.created_at.isoformat()
            }
            for c in commands
        ]
    }
