import json
import os
from dotenv import load_dotenv
import httpx
from typing import List

load_dotenv()

API_KEY = os.getenv("API_KEY")
VERIFY_SSL = os.getenv("AICAFE_VERIFY_SSL", "true").lower() in ("1", "true", "yes")
ALLOW_LOCAL_FALLBACK = os.getenv("ALLOW_LOCAL_FALLBACK", "false").lower() in ("1", "true", "yes")
AICAFE_BASE_URL = os.getenv("AICAFE_BASE_URL", "https://aicafe.hcl.com")
DEPLOYMENT_NAME = os.getenv("AICAFE_DEPLOYMENT_NAME", "gpt-4.1")
API_VERSION = os.getenv("AICAFE_API_VERSION", "2024-02-15-preview")
ENDPOINT = f"{AICAFE_BASE_URL}/AICafeService/api/v1/subscription/openai/deployments/{DEPLOYMENT_NAME}/chat/completions?api-version={API_VERSION}"


def _local_clarification(
    message: str,
    clarification_answer: str | None = None,
    previous_question: str | None = None,
) -> dict:
    """Fallback clarification logic when AI service is unavailable."""
    if clarification_answer and previous_question:
        clarified = f"{message.strip()} [Clarification: {clarification_answer.strip()}]".strip()
        return {
            "clarification_needed": False,
            "clarification_question": None,
            "clarified_message": clarified,
            "urgency_context": clarification_answer,
        }

    text = message.strip()
    lowered = text.lower()
    
    # Keywords that indicate sufficient detail provided
    detail_keywords = {
        "error": ["error", "error code", "exception"],
        "database": ["database", "db", "sql", "query", "oracle"],
        "network": ["network", "vpn", "latency", "packet", "firewall", "dns"],
        "access": ["access", "permission", "forbidden", "unauthorized", "401", "403"],
        "outage": ["outage", "down", "offline", "unavailable", "critical"],
        "performance": ["slow", "slow", "timeout", "degraded", "latency"],
        "security": ["security", "breach", "malware", "phishing", "unauthorized"],
    }
    
    # Flatten all keywords
    all_detail_keywords = [kw for keywords in detail_keywords.values() for kw in keywords]
    
    # Check message quality
    has_detail = any(k in lowered for k in all_detail_keywords)
    is_descriptive = len(text) >= 30
    
    needs_clarification = not (has_detail and is_descriptive)
    
    if needs_clarification:
        # Generate contextual clarification question
        if "error" in lowered:
            question = "What is the error message or code? When does it occur (specific time/frequency)?"
        elif any(k in lowered for k in ["access", "permission", "cannot", "cannot", "can't"]):
            question = "Which system/app is affected? What action were you trying to perform?"
        elif any(k in lowered for k in ["slow", "timeout", "degraded"]):
            question = "How long has this been happening? Are all users affected or just some?"
        elif any(k in lowered for k in ["database", "sql", "query"]):
            question = "Which database/table is affected? Can you provide the query or error details?"
        elif any(k in lowered for k in ["outage", "down", "offline"]):
            question = "How many users are affected? What's the business impact?"
        else:
            question = "Can you provide more detail: affected application, error message/symptoms, and business impact?"
        
        return {
            "clarification_needed": True,
            "clarification_question": question,
            "clarified_message": text,
            "urgency_context": text,
        }

    return {
        "clarification_needed": False,
        "clarification_question": None,
        "clarified_message": text,
        "urgency_context": text,
    }


def _local_classification(clarified_message: str, urgency_context: str | None = None) -> dict:
    """Fallback classification logic when AI service is unavailable."""
    text = f"{clarified_message} {urgency_context or ''}".lower()

    # Team assignment with keyword patterns
    team_patterns = {
        "Security": ["breach", "unauthorized", "malware", "phishing", "security", "ransomware", "ddos"],
        "Database Team": ["database", "sql", "oracle", "query", "schema", "db", "postgres", "mysql", "data corruption"],
        "Network Support": ["network", "vpn", "packet", "latency", "dns", "firewall", "connectivity", "bandwidth"],
        "AWS Support": ["aws", "s3", "ec2", "cloud", "iam", "lambda", "rds", "s3 bucket"],
        "Windows Support": ["windows", "active directory", "ad", "domain", "group policy", "powershell"],
        "Unix Support": ["unix", "linux", "shell", "sudo", "ssh", "bash", "cron"],
        "Development": ["deploy", "api", "code", "service", "upload", "bug", "application", "build", "release"],
    }

    assigned_team = "Helpdesk"  # Default
    for team, keywords in team_patterns.items():
        if any(kw in text for kw in keywords):
            assigned_team = team
            break

    # Priority assignment with keyword patterns and scoring
    priority_keywords = {
        "P1": ["outage", "production down", "critical", "all users", "sev1", "breach", "security incident", "data loss"],
        "P2": ["urgent", "degraded", "timeout", "cannot", "can't", "failing", "payroll", "payment", "major impact"],
        "P3": ["slow", "intermittent", "workaround", "minor", "inconvenience", "limited"],
        "P4": ["question", "info", "general", "enhancement", "nice-to-have"],
    }

    priority = "P4"  # Default to lowest
    for p, keywords in priority_keywords.items():
        if any(kw in text for kw in keywords):
            priority = p
            break

    # Additional scoring: if message contains "urgent" or "asap", bump up priority
    if any(word in text for word in ["urgent", "asap", "immediately", "right now"]):
        if priority == "P4":
            priority = "P2"
        elif priority == "P3":
            priority = "P2"

    return {"team": assigned_team, "priority": priority}

async def call_aicafe(messages: List[dict]) -> str:
    if not API_KEY or API_KEY.strip().lower() in ("your_api_key", "replace_me", ""):
        raise RuntimeError("Missing or placeholder API_KEY in backend/.env. Set your HCL AICafe api-key value.")

    async with httpx.AsyncClient(verify=VERIFY_SSL) as client:
        try:
            response = await client.post(
                ENDPOINT,
                headers={
                    "Content-Type": "application/json",
                    "api-key": API_KEY,
                },
                json={
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 300,
                },
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            details = exc.response.text.strip()
            if status_code == 401:
                raise RuntimeError(
                    "HCL AICafe returned 401 Unauthorized. "
                    "Please verify your API_KEY, deployment name, and API_VERSION in backend/.env."
                ) from exc
            if status_code in {429, 500, 502, 503, 504}:
                raise RuntimeError("AI service is unavailable at the moment. Try Again Later") from exc
            try:
                body = exc.response.json()
                if body.get("code") == 2038 or "token limit" in body.get("message", "").lower():
                    raise RuntimeError("AI service is unavailable at the moment. Try Again Later") from exc
            except (ValueError, KeyError):
                pass
            raise RuntimeError(
                f"HCL AICafe returned HTTP {status_code}. Response body: {details}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError("AI service is unavailable at the moment. Try Again Later") from exc

        data = response.json()

        if "choices" not in data or not data["choices"]:
            raise RuntimeError("AICafe returned no choices")

        return data["choices"][0]["message"]["content"]


def _extract_json(raw: str) -> str:
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1 and end > start:
        return raw[start:end + 1]
    return raw


def _safe_parse_json(raw: str) -> dict:
    payload = _extract_json(raw)
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return {}


async def clarification_agent(
    message: str,
    history: List[str],
    clarification_answer: str | None = None,
    previous_question: str | None = None,
) -> dict:
    prompt = (
        "You are an AI clarification assistant for an internal ticketing system. "
        "Review the user's ticket request and determine whether additional detail is needed and capture urgency context. "
        "If clarification is required, ask one short follow-up question. Otherwise, provide a clean clarified ticket summary.\n\n"
        f"User message: {message}\n"
        f"Conversation history: {' | '.join(history) if history else 'none'}\n\n"
        "Respond with a JSON object using these keys: clarification_needed, clarification_question, clarified_message, urgency_context. "
        "Set urgency_context to a short sentence summarizing impact/urgency (for example: 'Production login outage affecting all users'). "
        "If no clarification is required, set clarification_needed to false and clarification_question to null."
    )

    if clarification_answer and previous_question:
        prompt = (
            "You previously asked the user a follow-up question and have now received their answer. "
            "Use the original ticket, the prior clarification question, and the user's answer to produce a final clarified ticket summary. "
            "If the answer is still not sufficient, ask one more short follow-up question.\n\n"
            f"Original ticket: {message}\n"
            f"Clarification question: {previous_question}\n"
            f"User answer: {clarification_answer}\n"
            f"Conversation history: {' | '.join(history) if history else 'none'}\n\n"
            "Respond with a JSON object using these keys: clarification_needed, clarification_question, clarified_message, urgency_context. "
            "Set urgency_context to a short sentence summarizing impact/urgency. "
            "If no clarification is required, set clarification_needed to false and clarification_question to null."
        )

    messages = [
        {"role": "system", "content": "You are an assistant that prepares internal ticket requests."},
        {"role": "user", "content": prompt},
    ]
    try:
        raw_response = await call_aicafe(messages)
        source = "ai"
    except RuntimeError:
        if ALLOW_LOCAL_FALLBACK:
            result = _local_clarification(message, clarification_answer, previous_question)
            result["source"] = "fallback"
            return result
        raise

    payload = _safe_parse_json(raw_response)

    if payload.get("clarification_needed") is None:
        text = raw_response.strip()
        needs = "clarify" in text.lower() or text.endswith("?")
        fallback = {
            "clarification_needed": needs,
            "clarification_question": text if needs else None,
            "clarified_message": text if not needs else message,
            "urgency_context": message,
            "source": source,
        }
        return fallback

    clarification_needed = bool(payload.get("clarification_needed"))
    clarified_message = payload.get("clarified_message") or message
    clarification_question = payload.get("clarification_question")
    urgency_context = payload.get("urgency_context") or clarified_message

    if clarification_needed and not clarification_question:
        fallback_text = raw_response.strip()
        if fallback_text.endswith("?"):
            clarification_question = fallback_text
        else:
            clarification_question = "Can you provide more detail so we can route this request correctly?"

    return {
        "clarification_needed": clarification_needed,
        "clarification_question": clarification_question,
        "clarified_message": clarified_message,
        "urgency_context": urgency_context,
        "source": source,
    }


async def classification_agent(clarified_message: str, urgency_context: str | None = None) -> dict:
    prompt = (
        "You are an AI ticket triage assistant. Assign each ticket to the best team and classify priority as P1, P2, P3, or P4. "
        "Priority policy: P1 = critical outage/security incident/high business impact; P2 = major degradation or urgent deadline risk; "
        "P3 = moderate issue with workaround or limited impact; P4 = low-impact request/enhancement.\n\n"
        f"Clarified ticket: {clarified_message}\n"
        f"Urgency context: {urgency_context or 'none'}\n"
        "Available teams: Helpdesk, Development, Database Team, Network Support, Unix Support, Windows Support, AWS Support, Security."
        "\nRespond with JSON using keys: team, priority."
    )

    messages = [
        {"role": "system", "content": "You classify tickets to internal support teams."},
        {"role": "user", "content": prompt},
    ]
    try:
        raw_response = await call_aicafe(messages)
        source = "ai"
    except RuntimeError:
        if ALLOW_LOCAL_FALLBACK:
            result = _local_classification(clarified_message, urgency_context)
            result["source"] = "fallback"
            return result
        raise

    payload = _safe_parse_json(raw_response)
    team = payload.get("team")
    priority = str(payload.get("priority") or "").upper().strip()

    if priority not in {"P1", "P2", "P3", "P4"}:
        urgency_text = f"{clarified_message} {urgency_context or ''}".lower()
        if any(keyword in urgency_text for keyword in ["outage", "down", "breach", "critical", "all users"]):
            priority = "P1"
        elif any(keyword in urgency_text for keyword in ["urgent", "high", "degraded", "cannot", "can't"]):
            priority = "P2"
        elif any(keyword in urgency_text for keyword in ["minor", "slow", "intermittent", "workaround"]):
            priority = "P3"
        else:
            priority = "P4"

    if not team:
        team = raw_response.strip().splitlines()[0]

    return {"team": team, "priority": priority, "source": source}
