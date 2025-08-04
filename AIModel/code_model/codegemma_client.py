# codegemma_client.py
import httpx
import os

HUGGINGFACE_TOKEN = os.getenv("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")  # Load from environment

async def query_codegemma(prompt: str) -> str:
    url = "https://api-inference.huggingface.co/models/google/codegemma-7b-it"
    headers = {
        "Authorization": f"Bearer {HUGGINGFACE_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 300,
            "temperature": 0.2,
            "top_p": 0.9,
            "do_sample": True
        }
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()

    return result[0]["generated_text"]
