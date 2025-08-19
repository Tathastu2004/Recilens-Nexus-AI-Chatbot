# ollama_client.py
import httpx

async def generate_chat_response_stream(prompt):
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3",
        "prompt": prompt,
        "stream": True
    }

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, json=payload) as response:
            async for line in response.aiter_lines():
                if line.strip():
                    yield line + "\n"

async def recognize_intent(message: str) -> str:
    prompt = f"""
You are an intent classifier. Given this user message:
\"\"\"{message}\"\"\"
Return only one intent label from this list:
book_flight, greeting, cancel_booking, ask_weather, general, unknown.

Intent:
"""
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": "llama3",
        "prompt": prompt,
        "stream": False
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        # Ollama's response usually has 'response' key for text output
        # If using OpenAI-like API, adjust accordingly
        intent_text = data.get("response", "").strip().lower()
        # Fallback to "unknown" if not found
        return intent_text or "unknown"
