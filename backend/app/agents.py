import json
import os
import re
import asyncio
from dotenv import load_dotenv
import httpx
from typing import List

load_dotenv()

API_KEY = os.getenv("API_KEY")
VERIFY_SSL = os.getenv("AICAFE_VERIFY_SSL", "true").lower() in ("1", "true", "yes")
AICAFE_BASE_URL = os.getenv("AICAFE_BASE_URL", "https://aicafe.hcl.com")
DEPLOYMENT_NAME = os.getenv("AICAFE_DEPLOYMENT_NAME", "gpt-4.1")
API_VERSION = os.getenv("AICAFE_API_VERSION", "2024-02-15-preview")
ENDPOINT = f"{AICAFE_BASE_URL}/AICafeService/api/v1/subscription/openai/deployments/{DEPLOYMENT_NAME}/chat/completions?api-version={API_VERSION}"
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_AICAFE_ATTEMPTS = 3

async def call_aicafe(messages: List[dict]) -> str:
    if not API_KEY or API_KEY.strip().lower() in ("your_api_key", "replace_me", ""):
        raise RuntimeError("Missing or placeholder API_KEY in backend/.env. Set your HCL AICafe api-key value.")

    async with httpx.AsyncClient(verify=VERIFY_SSL) as client:
        last_error: RuntimeError | None = None
        for attempt in range(1, MAX_AICAFE_ATTEMPTS + 1):
            try:
                response = await client.post(
                    ENDPOINT,
                    headers={
                        "Content-Type": "application/json",
                        "api-key": API_KEY,
                    },
                    json={
                        "messages": messages,
                        "temperature": 0.2,
                        "max_tokens": 600,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                if "choices" not in data or not data["choices"]:
                    raise RuntimeError("AICafe returned no choices")

                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                details = exc.response.text.strip()
                if status_code == 401:
                    raise RuntimeError(
                        "HCL AICafe returned 401 Unauthorized. "
                        "Please verify your API_KEY, deployment name, and API_VERSION in backend/.env."
                    ) from exc

                is_retryable = status_code in RETRYABLE_STATUS_CODES
                if is_retryable and attempt < MAX_AICAFE_ATTEMPTS:
                    await asyncio.sleep(0.5 * attempt)
                    continue

                try:
                    body = exc.response.json()
                    if body.get("code") == 2038 or "token limit" in body.get("message", "").lower():
                        raise RuntimeError(
                            "AICafe access is suspended due to token limit. "
                            "Please contact support to restore API access."
                        ) from exc
                except (ValueError, KeyError):
                    pass

                if is_retryable:
                    raise RuntimeError("AI service is unavailable at the moment. Try Again Later") from exc

                raise RuntimeError(
                    f"HCL AICafe returned HTTP {status_code}. Response body: {details}"
                ) from exc
            except httpx.RequestError as exc:
                last_error = RuntimeError("AI service is unavailable at the moment. Try Again Later")
                if attempt < MAX_AICAFE_ATTEMPTS:
                    await asyncio.sleep(0.5 * attempt)
                    continue
                raise last_error from exc

        raise last_error or RuntimeError("AI service is unavailable at the moment. Try Again Later")


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


_SYSTEM_TERMS = [
    "app", "application", "portal", "service", "system", "vpn", "email", "outlook",
    "database", "db", "server", "sap", "oracle", "salesforce", "network", "windows",
    "linux", "unix", "website", "site", "intranet", "sharepoint", "teams", "slack",
    "jira", "confluence", "printer", "laptop", "desktop", "browser", "chrome", "edge",
]
_ISSUE_TERMS = [
    "cannot", "can't", "cant", "unable", "failed", "failing", "fails", "error", "errors",
    "down", "timeout", "timing out", "slow", "lag", "lagging", "disconnect", "disconnects",
    "disconnected", "crash", "crashes", "crashing", "freeze", "frozen", "hangs",
    "broken", "not working", "doesn't work", "does not work", "stuck", "stopped",
    "blocked", "blocking", "rejected", "denied", "missing", "404", "500", "503",
]
_IMPACT_TERMS = [
    "users", "user", "team", "teams", "everyone", "customers", "customer", "client",
    "clients", "business", "production", "prod", "department", "office", "site",
    "branch", "everybody", "all of us", "many people", "multiple users", "entire",
    "company-wide", "company wide",
]
_URGENCY_TERMS = [
    "urgent", "urgently", "asap", "immediately", "right now", "deadline", "eod",
    "end of day", "critical", "p1", "p2", "sev1", "sev 1", "high priority",
    "blocker", "blocking", "outage", "production down",
]


def _has_term(text: str, terms: list[str]) -> bool:
    """Word-boundary safe check; supports multi-word phrases too."""
    if not text:
        return False
    for term in terms:
        if " " in term:
            if term in text:
                return True
        else:
            if re.search(rf"\b{re.escape(term)}\b", text):
                return True
    return False


def _clarity_signals(text: str) -> dict[str, bool]:
    lowered = (text or "").strip().lower()
    return {
        "has_system": _has_term(lowered, _SYSTEM_TERMS),
        "has_issue": _has_term(lowered, _ISSUE_TERMS),
        "has_impact": _has_term(lowered, _IMPACT_TERMS),
        "has_urgency": _has_term(lowered, _URGENCY_TERMS),
    }


def _is_clarity_complete(text: str) -> bool:
    signals = _clarity_signals(text)
    # Strict: must include system + issue + impact + urgency to skip clarification.
    return (
        signals["has_system"]
        and signals["has_issue"]
        and signals["has_impact"]
        and signals["has_urgency"]
    )


def _needs_clarification_guardrail(message: str) -> bool:
    text = (message or "").strip().lower()
    if not text:
        return True

    # Short requests are almost always missing routing details.
    if len(text.split()) < 12:
        return True

    return not _is_clarity_complete(text)


def _default_clarification_question(message: str) -> str:
    signals = _clarity_signals(message)
    missing = []
    if not signals["has_system"]:
        missing.append("affected app/system")
    if not signals["has_issue"]:
        missing.append("exact issue/error")
    if not signals["has_impact"]:
        missing.append("who/how many are impacted")
    if not signals["has_urgency"]:
        missing.append("urgency or deadline")

    if not missing:
        return "Can you share a bit more detail so we can route this correctly?"

    return f"Please share the {', '.join(missing)}."


CLARIFICATION_SYSTEM_PROMPT = (
    "You are an expert L1 IT support triage agent for an internal ticketing system. "
    "Your job is to make sure every ticket has enough detail to be routed and resolved without back-and-forth. "
    "You assess each user request like a real support engineer would: critically, skeptically, and only "
    "approving a ticket when it has enough actionable information.\n\n"
    "REQUIRED INFORMATION CHECKLIST (a ticket must satisfy ALL four to skip clarification):\n"
    "  1. AFFECTED SYSTEM/SERVICE  - which app, tool, environment, device, or service is involved?\n"
    "                                Vague nouns like 'thing', 'it', 'something' do NOT count.\n"
    "  2. SPECIFIC SYMPTOM/ERROR    - what is actually happening? Error message, behavior, or precise failure mode.\n"
    "                                'not working', 'broken', 'issue' alone do NOT count.\n"
    "  3. SCOPE / IMPACT            - who is affected (just me / my team / a department / all users / a customer)?\n"
    "  4. URGENCY OR DEADLINE       - how time-sensitive is this (blocker now / by EOD / this week / no rush)?\n\n"
    "ASSESSMENT RULES:\n"
    "  - If ANY of the four items is missing OR vague, set clarification_needed=true.\n"
    "  - Ask ONE focused, friendly question that targets the MOST important missing item(s). Combine at most 2 missing items into one question; do NOT ask 3+ things at once.\n"
    "  - Never ask for information the user already gave (read carefully, including history).\n"
    "  - If everything is present, set clarification_needed=false and produce a clean clarified_message in the form:\n"
    "      '<system> - <symptom>. Impact: <who>. Urgency: <when>.'\n"
    "  - urgency_context must be a short sentence stating impact + urgency, e.g.\n"
    "      'Production VPN down for entire APAC team, blocking work right now.'\n"
    "  - Output STRICT JSON only. No prose outside JSON. No markdown fences.\n\n"
    "OUTPUT JSON SCHEMA:\n"
    "{\n"
    '  "assessment": {\n'
    '    "has_system": true|false,\n'
    '    "has_symptom": true|false,\n'
    '    "has_impact": true|false,\n'
    '    "has_urgency": true|false,\n'
    '    "missing": ["system"|"symptom"|"impact"|"urgency", ...],\n'
    '    "reasoning": "one short sentence on why clarification is or is not needed"\n'
    "  },\n"
    '  "clarification_needed": true|false,\n'
    '  "clarification_question": "single targeted question or null",\n'
    '  "clarified_message": "clean ticket summary or original message",\n'
    '  "urgency_context": "short impact+urgency sentence"\n'
    "}\n\n"
    "EXAMPLES:\n"
    "User: 'outlook is slow'\n"
    "-> missing: symptom detail (how slow / since when), impact (just you?), urgency.\n"
    "   clarification_needed=true, ask: 'Is this only on your laptop or affecting others, and how urgent is it?'\n\n"
    "User: 'my laptop'\n"
    "-> missing: symptom, impact, urgency.\n"
    "   clarification_needed=true, ask: 'What is happening with your laptop and how soon do you need help?'\n\n"
    "User: 'Production SAP login is failing with error AUTH-500 for the entire finance team since 10am, "
    "blocking month-end close - need fix ASAP.'\n"
    "-> all four present.\n"
    "   clarification_needed=false, clarified_message and urgency_context populated."
)


def _build_clarification_prompt(
    message: str,
    history: List[str],
    clarification_answer: str | None,
    previous_question: str | None,
) -> str:
    history_text = " | ".join(history) if history else "none"
    if clarification_answer and previous_question:
        return (
            "You previously asked the user a follow-up question. Now reassess using the ORIGINAL request, "
            "your prior question, and the user's answer combined.\n\n"
            f"ORIGINAL REQUEST: {message}\n"
            f"YOUR PREVIOUS QUESTION: {previous_question}\n"
            f"USER'S ANSWER: {clarification_answer}\n"
            f"CONVERSATION HISTORY: {history_text}\n\n"
            "Re-run the 4-item checklist on the COMBINED information. "
            "If the answer fills the gaps, set clarification_needed=false and produce the clarified_message. "
            "If the user's answer is still vague (e.g., 'I don't know', 'just fix it'), ask ONE more targeted question. "
            "Do not loop on the same question - if you already asked it once and got a non-answer, infer reasonable defaults "
            "(scope=just the user, urgency=normal) and proceed.\n\n"
            "Respond with the JSON schema described in your system prompt."
        )

    return (
        "Assess the following ticket request against the 4-item checklist in your system prompt.\n\n"
        f"USER REQUEST: {message}\n"
        f"CONVERSATION HISTORY: {history_text}\n\n"
        "Respond with the JSON schema described in your system prompt."
    )


async def clarification_agent(
    message: str,
    history: List[str],
    clarification_answer: str | None = None,
    previous_question: str | None = None,
) -> dict:
    user_prompt = _build_clarification_prompt(message, history, clarification_answer, previous_question)

    messages = [
        {"role": "system", "content": CLARIFICATION_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    raw_response = await call_aicafe(messages)
    source = "ai"

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
    assessment = payload.get("assessment") or {}
    complete_text = (
        f"{message}\n{clarification_answer}" if clarification_answer else message
    )

    # Trust the AI's structured assessment when it explicitly lists missing items.
    ai_missing = assessment.get("missing") if isinstance(assessment, dict) else None
    ai_says_complete = isinstance(ai_missing, list) and len(ai_missing) == 0

    # If the AI claims complete AND deterministic check agrees, trust it.
    if not clarification_needed and ai_says_complete and _is_clarity_complete(complete_text):
        if clarification_answer:
            clarified_message = clarified_message or f"{message} Clarification: {clarification_answer}".strip()
            urgency_context = urgency_context or clarified_message
    else:
        # Guardrail: the AI tried to skip but data is still thin -> force one more question.
        if not clarification_needed and _needs_clarification_guardrail(complete_text):
            clarification_needed = True
            clarification_question = (
                payload.get("clarification_question")
                or _default_clarification_question(complete_text)
            )
            clarified_message = message
            urgency_context = message

    # Conversely: if the AI insists on more clarification but the user has clearly given everything
    # (after follow-up answer) and deterministic check passes, allow ticket creation.
    if clarification_needed and clarification_answer and _is_clarity_complete(complete_text):
        clarification_needed = False
        clarification_question = None
        clarified_message = clarified_message if clarified_message != message else (
            f"{message} Clarification: {clarification_answer}".strip()
        )
        urgency_context = urgency_context or clarified_message

    if clarification_needed and not clarification_question:
        clarification_question = _default_clarification_question(complete_text)

    return {
        "clarification_needed": clarification_needed,
        "clarification_question": clarification_question,
        "clarified_message": clarified_message,
        "urgency_context": urgency_context,
        "source": source,
    }


CLASSIFICATION_SYSTEM_PROMPT = (
    "You are an expert IT triage classifier. Given a clarified ticket, you assign:\n"
    "  - the BEST owning team from the allowed list, and\n"
    "  - a priority P1/P2/P3/P4 using strict business-impact rules.\n\n"
    "PRIORITY RUBRIC (apply the FIRST one that matches):\n"
    "  P1 = full outage of a production system, security breach, data loss risk, or many users blocked NOW.\n"
    "  P2 = major degradation, single critical user blocked, deadline at risk within 24h, or production-impacting bug with workaround.\n"
    "  P3 = moderate issue with workaround, single user affected, no immediate deadline.\n"
    "  P4 = request, question, enhancement, low-impact cosmetic issue, or 'no rush'.\n\n"
    "TEAM ROUTING HINTS:\n"
    "  Helpdesk          - account, password, MFA, basic device/printer, generic 'how do I' questions.\n"
    "  Development       - bugs in in-house apps, code/feature defects, API logic errors.\n"
    "  Database Team     - SQL issues, slow queries, DB connectivity, replication, schema, ORA-/SQL-Server errors.\n"
    "  Network Support   - VPN, Wi-Fi, LAN/WAN, DNS, firewall, connectivity drops.\n"
    "  Unix Support      - Linux/Unix server admin, shell, cron, filesystem.\n"
    "  Windows Support   - Windows server/desktop OS, AD, GPO, Outlook/Exchange client.\n"
    "  AWS Support       - AWS console, EC2, S3, IAM, CloudWatch, Lambda, billing.\n"
    "  Security          - phishing, suspected compromise, access escalation, audit, malware.\n\n"
    "RULES:\n"
    "  - Pick exactly one team and exactly one priority.\n"
    "  - Justify briefly in 'reasoning' (one sentence).\n"
    "  - Output STRICT JSON only. No prose, no markdown.\n\n"
    "OUTPUT JSON SCHEMA:\n"
    "{\n"
    '  "team": "<one of the allowed teams>",\n'
    '  "priority": "P1"|"P2"|"P3"|"P4",\n'
    '  "reasoning": "short why"\n'
    "}"
)


async def classification_agent(clarified_message: str, urgency_context: str | None = None) -> dict:
    user_prompt = (
        "Classify the following ticket using the rubric in your system prompt.\n\n"
        f"CLARIFIED TICKET: {clarified_message}\n"
        f"URGENCY CONTEXT: {urgency_context or 'none'}\n\n"
        "Respond with the JSON schema described in your system prompt."
    )

    messages = [
        {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    raw_response = await call_aicafe(messages)
    source = "ai"

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
