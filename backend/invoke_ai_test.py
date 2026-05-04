import asyncio
import os
import sys

import httpx
from dotenv import load_dotenv


load_dotenv()


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


async def main() -> int:
    api_key = _required_env("API_KEY")
    base_url = os.getenv("AICAFE_BASE_URL", "https://aicafe.hcl.com").strip()
    deployment = os.getenv("AICAFE_DEPLOYMENT_NAME", "gpt-4.1").strip()
    api_version = os.getenv("AICAFE_API_VERSION", "2024-02-15-preview").strip()
    verify_ssl = os.getenv("AICAFE_VERIFY_SSL", "true").lower() in ("1", "true", "yes")

    endpoint = (
        f"{base_url}/AICafeService/api/v1/subscription/openai/deployments/"
        f"{deployment}/chat/completions?api-version={api_version}"
    )

    payload = {
        "messages": [
            {"role": "system", "content": "You are a concise assistant."},
            {"role": "user", "content": "Reply with exactly: AI_TEST_OK"},
        ],
        "temperature": 0.0,
        "max_tokens": 20,
    }

    try:
        async with httpx.AsyncClient(verify=verify_ssl, timeout=30.0) as client:
            response = await client.post(
                endpoint,
                headers={
                    "Content-Type": "application/json",
                    "api-key": api_key,
                },
                json=payload,
            )

        print(f"STATUS: {response.status_code}")
        print(f"ENDPOINT: {endpoint}")

        body_preview = response.text[:500].replace("\n", " ")
        print(f"BODY_PREVIEW: {body_preview}")

        if response.status_code >= 400:
            return 1

        data = response.json()
        content = ""
        if data.get("choices"):
            content = data["choices"][0].get("message", {}).get("content", "")
        print(f"MODEL_REPLY: {content}")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
