# codegemma_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from codegemma_client import query_codegemma

router = APIRouter()

class CodeRequest(BaseModel):
    prompt: str

@router.post("/codegemma")
async def generate_codegemma_response(request: CodeRequest):
    try:
        response = await query_codegemma(request.prompt)
        return { "response": response.strip() }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
