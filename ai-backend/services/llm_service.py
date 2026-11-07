"""
LLM Service — Google Gemini + OpenAI Integration
Handles all AI/LLM calls with fallback support
"""
try:
    from google import genai
    from google.genai import types as genai_types
    GENAI_NEW = True
except ImportError:
    import google.generativeai as genai  # type: ignore
    GENAI_NEW = False
from openai import AsyncOpenAI
from config import settings
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
            if GENAI_NEW:
                self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
                self.gemini_model_name = settings.GEMINI_MODEL
                self.gemini_model = None
            else:
                genai.configure(api_key=settings.GEMINI_API_KEY)  # type: ignore
                self.gemini_model = genai.GenerativeModel(  # type: ignore
                    model_name=settings.GEMINI_MODEL,
                    generation_config={"temperature": 0.7, "top_p": 0.95, "max_output_tokens": 1500}
                )
            logger.info(f"✅ Gemini LLM initialized: {settings.GEMINI_MODEL}")

        elif self.provider == "openai" and settings.OPENAI_API_KEY:
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
                response = self.gemini_model.generate_content(prompt)
                text = response.text.strip()
                parsed = self._extract_json(text)
                if isinstance(parsed, list):
                    return parsed
            return self._mock_insights()
        except Exception as e:
            logger.error(f"Insight generation failed: {e}")
            return self._mock_insights()

    async def _call_gemini(self, prompt: str) -> dict:
        """Call Google Gemini API (supports both old and new SDK)"""
        try:
            if GENAI_NEW and hasattr(self, 'gemini_client'):
                import asyncio
                response = await asyncio.to_thread(
                    self.gemini_client.models.generate_content,
                    model=self.gemini_model_name,
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(
                        temperature=0.7,
                        max_output_tokens=1500
                    )
                )
                text = response.text.strip()
            else:
                response = self.gemini_model.generate_content(prompt)
                text = response.text.strip()

            usage = getattr(response, 'usage_metadata', None)
            parsed = self._extract_json(text)
            if isinstance(parsed, dict) and "response" in parsed:
                parsed["model"] = settings.GEMINI_MODEL
                parsed["prompt_tokens"] = getattr(usage, 'prompt_token_count', 0) if usage else 0
                parsed["completion_tokens"] = getattr(usage, 'candidates_token_count', 0) if usage else 0
                return parsed

            return {
                "response": text, "insight_type": "general", "confidence": 0.75,
                "suggestions": [], "model": settings.GEMINI_MODEL, "prompt_tokens": 0, "completion_tokens": 0
            }
        except Exception as e:
            logger.error(f"Gemini call error: {e}")
            raise

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
        """Demo response when no LLM key is configured"""
        responses = {
            "spend": {
                "response": "Based on your financial data, your top spending category is Food (35% of expenses). Over the last 3 months, you've spent LKR 45,000 on dining. Consider meal prepping to reduce this by 20%, saving approximately LKR 9,000/month.\n\n**Key Observations:**\n- Weekend spending is 40% higher than weekdays\n- Entertainment budget is exceeded by 15%\n- Transport costs have increased 12% vs last month\n\n**Action Plan:**\n1. Set a weekly dining budget of LKR 5,000\n2. Use the budget tracker for real-time alerts\n3. Review subscriptions — potential LKR 3,500 in savings",
                "insight_type": "spending_analysis",
                "suggestions": ["Set weekly dining budget", "Review subscriptions", "Track weekend spending"]
            },
            "save": {
                "response": "Your current savings rate is 18%, which is good! To reach financial independence faster, aim for 25-30%.\n\n**Your Savings Goals Progress:**\n- Emergency Fund: 60% complete — great progress!\n- Vacation Fund: 25% — on track for December\n\n**To boost savings by LKR 10,000/month:**\n1. Automate a LKR 5,000 transfer on salary day\n2. Use the 24-hour rule for non-essential purchases over LKR 2,000\n3. Redirect 50% of any income increase directly to savings",
                "insight_type": "saving_recommendation",
                "suggestions": ["Automate savings transfer", "Apply 24-hour purchase rule", "Increase rate to 25%"]
            },
            "invest": {
                "response": "Your investment portfolio shows a 12% ROI over 6 months — excellent performance! Your allocation: 40% Fixed Deposits, 35% Stocks, 25% Mutual Funds.\n\n**Educational Insights:**\n- Diversification across 3+ asset classes reduces risk\n- Your FD rate of 11% beats inflation — solid choice\n- Consider SIP (Systematic Investment Plan) for rupee cost averaging\n\n⚠️ *This is educational information, not financial advice. Consult a licensed financial advisor for personalized investment decisions.*",
                "insight_type": "investment_education",
                "suggestions": ["Review asset allocation quarterly", "Consider SIP approach", "Consult financial advisor"]
            }
        }
        msg_lower = user_message.lower()
        for key, resp in responses.items():
            if key in msg_lower:
                resp["model"] = "demo-mode"
                resp["confidence"] = 0.70
                resp["prompt_tokens"] = 0
                resp["completion_tokens"] = 0
                return resp

        return {
            "response": f"I understand you're asking about '{user_message}'. Based on your financial profile, I can see you have a healthy financial foundation. Your savings rate is above the 15% recommended benchmark, and your budget utilization is well-managed. For specific insights, please configure your Gemini API key in the settings.",
            "insight_type": "general",
            "confidence": 0.60,
            "suggestions": ["Add your Gemini API key for real AI responses", "Review your monthly budget", "Check your financial health score"],
            "model": "demo-mode",
            "prompt_tokens": 0,
            "completion_tokens": 0
        }

    def _mock_insights(self) -> list:
        return [
            {
                "type": "spending_analysis",
                "title": "Food expenses 23% above monthly average",
                "content": "Your food spending this month is LKR 12,400 — 23% higher than your 3-month average of LKR 10,080. Consider meal prepping on weekends to reduce dining out frequency. Setting a weekly food budget alert at LKR 2,500 could help you stay on track.",
                "confidence": 0.88,
                "model": "demo-mode"
            },
            {
                "type": "saving_recommendation",
                "title": "You can save an extra LKR 8,000 this month",
                "content": "Based on your income and current spending patterns, you have LKR 8,000 in discretionary budget remaining this month. Allocating this to your Emergency Fund would bring it to 75% completion — just 2 months away from your goal!",
                "confidence": 0.82,
                "model": "demo-mode"
            },
            {
                "type": "investment_tip",
                "title": "Your portfolio is underperforming market benchmarks",
                "content": "Your current portfolio ROI (8.2%) is below the CSE All Share Index return (11.4%) for the same period. Consider reviewing your stock selections or switching to index funds for better diversification. *Educational only — not financial advice.*",
                "confidence": 0.75,
                "model": "demo-mode"
            }
        ]
