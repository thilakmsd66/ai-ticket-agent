import asyncio
import os
import sys

import httpx
from groq import Groq
from dotenv import load_dotenv


load_dotenv()


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


async def main() -> int:
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("API_KEY") or os.getenv("api_key")
    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY/API_KEY in environment.")

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    verify_ssl = os.getenv("GROQ_VERIFY_SSL", os.getenv("AICAFE_VERIFY_SSL", "true")).lower() in ("1", "true", "yes")

    try:
        if verify_ssl:
            client = Groq(api_key=api_key)
        else:
            client = Groq(api_key=api_key, http_client=httpx.Client(verify=False, timeout=30.0))
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a concise assistant."},
                {"role": "user", "content": "Reply with exactly: AI_TEST_OK"},
            ],
            model=model,
            max_tokens=20,
            temperature=0,
            top_p=1,
            stream=True,
            stop=None,
        )

        reply = ""
        for chunk in completion:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                reply += chunk.choices[0].delta.content

        print("STATUS: 200")
        print(f"MODEL: {model}")
        print(f"SSL_VERIFY: {verify_ssl}")
        print(f"MODEL_REPLY: {reply.replace('</s>', '').strip()}")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
