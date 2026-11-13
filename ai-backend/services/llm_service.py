"""
LLM Service — Google Gemini + OpenAI Integration
Handles all AI/LLM calls with fallback support
"""
import httpx
from config import settings
try:  # optional — only needed when LLM_PROVIDER=openai
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None  # type: ignore
import logging
import json
import re

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are FinAI, an expert AI-powered financial advisor integrated into the FinAI Enterprise platform.
You have access to the user's complete financial profile and transaction history.

Your capabilities:
- Analyze spending patterns and identify waste
- Provide personalized savings recommendations
- Explain financial concepts clearly
- Give investment education (not advice - always include disclaimer)
- Calculate financial health metrics
- Predict future financial trends
- Detect unusual spending patterns
- Create actionable financial improvement plans

Rules:
1. Always be specific and reference the user's actual numbers
2. Be encouraging but honest about problems
3. For investments, always add: "This is educational, not financial advice."
4. Provide 2-3 concrete action items when possible
5. Keep responses concise but comprehensive (200-400 words ideal)
6. Use the user's currency (LKR, USD, etc.)
7. Format responses with clear sections when helpful

Response format (JSON):
{
  "response": "Your detailed response here",
  "insight_type": "spending_analysis|saving_recommendation|investment_education|health_assessment|prediction|general",
  "confidence": 0.85,
  "suggestions": ["Action 1", "Action 2", "Action 3"]
}
"""


class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER

        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            # Gemini is called over its REST API with httpx (no SDK → small serverless bundle)
            self.gemini_key = settings.GEMINI_API_KEY
            logger.info(f"✅ Gemini LLM configured: {settings.GEMINI_MODEL}")

        elif self.provider == "openai" and settings.OPENAI_API_KEY and AsyncOpenAI:
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info(f"✅ OpenAI initialized: {settings.OPENAI_MODEL}")

        else:
            logger.warning("⚠️ No LLM API key configured — using mock responses")

    async def financial_advisor_chat(
        self,
        user_message: str,
        financial_context: str,
        conversation_history: list
    ) -> dict:
        """Main chat function — calls appropriate LLM"""
        prompt = f"""
{SYSTEM_PROMPT}

USER'S FINANCIAL DATA (Retrieved via RAG):
{financial_context}

CONVERSATION HISTORY:
{self._format_history(conversation_history)}

USER QUESTION: {user_message}

Respond in JSON format as specified.
"""
        try:
            if self.provider == "gemini" and settings.GEMINI_API_KEY:
                return await self._call_gemini(prompt)
            elif self.provider == "openai" and settings.OPENAI_API_KEY:
                return await self._call_openai(prompt, user_message)
            else:
                return self._mock_response(user_message)
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return self._mock_response(user_message)

    async def generate_proactive_insights(self, financial_context: str) -> list:
        """Generate weekly proactive insights without a user question"""
        prompt = f"""
You are FinAI, an expert financial advisor. Analyze the following financial data and generate 3 proactive insights.

{financial_context}

Generate exactly 3 insights as a JSON array:
[
  {{
    "type": "spending_analysis|saving_recommendation|investment_tip|fraud_alert|health_assessment",
    "title": "Short title (max 60 chars)",
    "content": "Detailed insight (100-200 words)",
    "confidence": 0.85,
    "model": "gemini-2.0-flash"
  }}
]

Focus on the most important financial concerns and opportunities.
"""
        try:
            if self.provider == "gemini" and settings.GEMINI_API_KEY:
                text = await self._gemini_raw(prompt)
                parsed = self._extract_json(text)
                if isinstance(parsed, list):
                    return parsed
            return self._mock_insights()
        except Exception as e:
            logger.error(f"Insight generation failed: {e}")
            return self._mock_insights()

    _health_cache: dict = {}

    async def check_health(self) -> dict:
        """Verify the configured LLM actually accepts our key (cached 5 min; no tokens used)."""
        import time as _t
        c = self._health_cache
        if c and _t.time() - c.get("at", 0) < 300:
            return c["result"]
        if settings.LLM_PROVIDER == "gemini" and getattr(self, "gemini_key", None):
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    r = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}", params={"key": self.gemini_key})
                result = {"status": "online"} if r.status_code == 200 else {"status": "error", "error": f"Gemini HTTP {r.status_code}: {r.text[:160]}"}
            except Exception as e:  # network
                result = {"status": "error", "error": str(e)[:160]}
        elif settings.LLM_PROVIDER == "openai" and getattr(self, "openai_client", None):
            result = {"status": "online"}
        else:
            result = {"status": "not_configured"}
        self._health_cache.update({"at": _t.time(), "result": result})
        return result

    async def _gemini_raw(self, prompt: str) -> str:
        return (await self._gemini_request(prompt))[0]

    async def _gemini_request(self, prompt: str):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1500, "responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, params={"key": self.gemini_key}, json=body)
        if r.status_code != 200:
            logger.error(f"Gemini HTTP {r.status_code}: {r.text[:300]}")
            raise RuntimeError(f"Gemini error {r.status_code}")
        data = r.json()
        parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts).strip(), data.get("usageMetadata", {})

    async def _call_gemini(self, prompt: str) -> dict:
        """Call Google Gemini via REST (generativelanguage.googleapis.com)."""
        text, usage = await self._gemini_request(prompt)
        parsed = self._extract_json(text)
        meta = {"model": settings.GEMINI_MODEL, "prompt_tokens": usage.get("promptTokenCount", 0), "completion_tokens": usage.get("candidatesTokenCount", 0)}
        if isinstance(parsed, dict) and "response" in parsed:
            return {**parsed, **meta}
        return {"response": text, "insight_type": "general", "confidence": 0.75, "suggestions": [], **meta}

    async def _call_openai(self, prompt: str, user_message: str) -> dict:
        """Call OpenAI API"""
        response = await self.openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Financial context available. User question: {user_message}"}
            ],
            response_format={"type": "json_object"},
            max_tokens=1200
        )
        text = response.choices[0].message.content
        parsed = json.loads(text)
        parsed["model"] = settings.OPENAI_MODEL
        parsed["prompt_tokens"] = response.usage.prompt_tokens
        parsed["completion_tokens"] = response.usage.completion_tokens
        return parsed

    def _extract_json(self, text: str) -> dict | list:
        """Extract JSON from LLM response, even if wrapped in markdown"""
        # Remove markdown code blocks
        text = re.sub(r'```(?:json)?\n?', '', text).strip()
        text = text.rstrip('`').strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in text
            match = re.search(r'\{.*\}|\[.*\]', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
        return {}

    def _format_history(self, history: list) -> str:
        if not history:
            return "No previous conversation."
        lines = []
        for msg in history[-6:]:  # Last 6 messages
            role = msg.get("role", "user").upper()
            content = msg.get("content", "")[:200]
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    def _mock_response(self, user_message: str) -> dict:
        """No LLM configured or the call failed. Never invent figures: return an explicit
        'unavailable' marker so the client answers from real data on-device instead."""
        return {
            "response": "The AI model is not available right now, so no AI answer was generated.",
            "insight_type": "general",
            "confidence": 0.0,
            "suggestions": [],
            "model": "unavailable",
            "prompt_tokens": 0,
            "completion_tokens": 0,
        }

    def _mock_insights(self) -> list:
        """No fabricated insights: return nothing when the model is unavailable."""
        return []

# Shared instance (used by /health and routers that don't create their own)
llm_service = LLMService()
