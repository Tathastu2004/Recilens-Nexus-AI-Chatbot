# main.py - UPDATED
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ollama import AsyncClient
import json
from typing import Optional, Dict, Any, List
import uuid
from datetime import datetime
import requests
import logging
import aiohttp
import psutil
import os
from dotenv import load_dotenv
load_dotenv()

# Load environment variables
LLAMA_URL = os.getenv("LLAMA_URL", "http://127.0.0.1:11434")
BLIP_URL = os.getenv("BLIP_URL", "http://127.0.0.1:5001")

# Import intent recognition from ollama_client
try:
    from ollama_client import recognize_intent
except ImportError:
    print("⚠️ [IMPORT] ollama_client not found, intent recognition disabled")
    async def recognize_intent(message: str) -> str:
        return "general"

# Add logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ ENHANCED CHAT REQUEST MODEL WITH CONTEXT
class ChatRequest(BaseModel):
    message: Optional[str] = None
    type: Optional[str] = "text"
    fileUrl: Optional[str] = None
    fileType: Optional[str] = None
    fileName: Optional[str] = None
    extractedText: Optional[str] = None
    conversationContext: Optional[List[Dict[str, Any]]] = []
    sessionId: Optional[str] = None

def generate_session_id():
    return str(uuid.uuid4())

# ✅ FIXED HEALTH CHECK ENDPOINT
@app.get("/health")
async def health_check():
    print("🩺 [HEALTH] Starting comprehensive health check...")
    
    health_status = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "services": {},
        "system": {}
    }
    
    # Check system resources
    try:
        health_status["system"] = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent,
        }
    except Exception as e:
        health_status["system"]["error"] = str(e)
    
    # ✅ FIXED BLIP SERVICE CHECK
    start_time = datetime.now()
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{BLIP_URL}/health") as response:
                response_time = (datetime.now() - start_time).total_seconds() * 1000
                if response.status == 200:
                    blip_data = await response.json()
                    health_status["services"]["blip"] = {
                        "status": "online",
                        "response_time_ms": round(response_time, 2),
                        "connected": blip_data.get("ok", False),
                        "last_checked": datetime.now().isoformat()
                    }
                else:
                    health_status["services"]["blip"] = {
                        "status": "offline",
                        "response_time_ms": round(response_time, 2),
                        "connected": False,
                        "last_checked": datetime.now().isoformat()
                    }
    except asyncio.TimeoutError:
        health_status["services"]["blip"] = {
            "status": "timeout",
            "error": "Service timeout after 5 seconds",
            "last_checked": datetime.now().isoformat()
        }
    except aiohttp.ClientConnectorError:
        health_status["services"]["blip"] = {
            "status": "offline",
            "error": "Cannot connect to BLIP service - make sure it's running on port 5001",
            "last_checked": datetime.now().isoformat()
        }
    except Exception as e:
        health_status["services"]["blip"] = {
            "status": "error",
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }
    
    # ✅ FIXED OLLAMA SERVICE CHECK
    start_time = datetime.now()
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{LLAMA_URL}/api/version") as response:
                response_time = (datetime.now() - start_time).total_seconds() * 1000
                if response.status == 200:
                    health_status["services"]["llama"] = {
                        "status": "online",
                        "response_time_ms": round(response_time, 2),
                        "connected": True,
                        "last_checked": datetime.now().isoformat()
                    }
                else:
                    health_status["services"]["llama"] = {
                        "status": "offline",
                        "response_time_ms": round(response_time, 2),
                        "connected": False,
                        "last_checked": datetime.now().isoformat()
                    }
    except asyncio.TimeoutError:
        health_status["services"]["llama"] = {
            "status": "timeout",
            "error": "Ollama service timeout after 5 seconds",
            "last_checked": datetime.now().isoformat()
        }
    except aiohttp.ClientConnectorError:
        health_status["services"]["llama"] = {
            "status": "offline",
            "error": "Cannot connect to Ollama service - make sure it's running",
            "last_checked": datetime.now().isoformat()
        }
    except Exception as e:
        health_status["services"]["llama"] = {
            "status": "offline",
            "error": str(e),
            "connected": False,
            "last_checked": datetime.now().isoformat()
        }
    
    # Database check (simulated)
    health_status["services"]["database"] = {
        "status": "online",
        "response_time_ms": 10,
        "connected": True,
        "type": "mongodb",
        "last_checked": datetime.now().isoformat()
    }
    
    # FastAPI self-check
    health_status["services"]["fastapi"] = {
        "status": "online",
        "response_time_ms": 0,
        "connected": True,
        "version": "1.0.0",
        "last_checked": datetime.now().isoformat()
    }
    
    # Overall health determination
    all_services = list(health_status["services"].values())
    online_count = sum(1 for service in all_services if service.get("status") == "online")
    total_count = len(all_services)
    
    if online_count == total_count:
        health_status["overall"] = "healthy"
    elif online_count > 0:
        health_status["overall"] = "degraded"
    else:
        health_status["overall"] = "unhealthy"
        
    health_status["summary"] = {
        "online_services": online_count,
        "total_services": total_count,
        "uptime_percentage": round((online_count / total_count) * 100, 1)
    }
    
    print(f"✅ [HEALTH] Health check completed: {health_status['overall']} ({online_count}/{total_count} services online)")
    return health_status

# ✅ SIMPLIFIED CHAT ENDPOINT (LLAMA ONLY FOR NOW)
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    print("🚀 [FASTAPI] ==================== CHAT REQUEST ====================")
    print(f"📥 [FASTAPI] Request details:")
    print(f"   Session: {request.sessionId[:8] if request.sessionId else 'None'}...")
    print(f"   Type: {request.type}")
    print(f"   Message: {request.message[:50] if request.message else 'None'}...")
    print(f"   Context Messages: {len(request.conversationContext or [])}")
    
    try:
        session_id = request.sessionId or generate_session_id()
        user_message = request.message or ""
        request_type = request.type or "text"
        conversation_context = request.conversationContext or []
        extracted_text = request.extractedText

        # ✅ DOCUMENT PROCESSING
        if request_type == "document" and extracted_text:
            print(f"📄 [FASTAPI] Document processing with extracted text ({len(extracted_text)} chars)")
            
            async def llama_document_response():
                try:
                    client = AsyncClient(host=LLAMA_URL)
                    
                    enhanced_prompt = f"""Document Content:
{extracted_text[:2000]}...

User Question: {user_message}

Please analyze the document and answer the user's question based on the content provided."""

                    messages = [
                        {'role': 'system', 'content': 'You are a helpful document analysis assistant.'},
                        {'role': 'user', 'content': enhanced_prompt}
                    ]
                    
                    stream = await client.chat(model='llama3', messages=messages, stream=True)
                    
                    async for chunk in stream:
                        content = chunk.get('message', {}).get('content', '')
                        if content:
                            yield content
                            await asyncio.sleep(0.05)
                            
                except Exception as e:
                    yield f"❌ Document Processing Error: {str(e)}"
                    
            return StreamingResponse(llama_document_response(), media_type="text/plain")
            
        # ✅ IMAGE PROCESSING (PLACEHOLDER)
        elif request_type == "image":
            print(f"🖼️ [FASTAPI] Image processing request")
            
            async def image_response():
                yield "🔄 Image analysis is temporarily unavailable. Please start the BLIP service first."
                
            return StreamingResponse(image_response(), media_type="text/plain")
            
        # ✅ TEXT CHAT WITH CONTEXT
        else:
            print(f"💬 [FASTAPI] Text chat with {len(conversation_context)} context messages")
            
            async def llama_text_response():
                try:
                    client = AsyncClient(host=LLAMA_URL)
                    
                    # Build messages with context
                    messages = [
                        {'role': 'system', 'content': 'You are a helpful AI assistant.'}
                    ]
                    
                    # Add recent context (last 10 messages)
                    recent_context = conversation_context[-10:] if len(conversation_context) > 10 else conversation_context
                    for ctx_msg in recent_context:
                        messages.append({
                            'role': ctx_msg.get('role', 'user'),
                            'content': ctx_msg.get('content', '')
                        })
                    
                    # Add current message
                    messages.append({'role': 'user', 'content': user_message})
                    
                    print(f"🦙 [LLAMA] Starting chat with {len(messages)} messages")
                    
                    stream = await client.chat(model='llama3', messages=messages, stream=True)
                    
                    word_buffer = ""
                    async for chunk in stream:
                        content = chunk.get('message', {}).get('content', '')
                        if content:
                            word_buffer += content
                            words = word_buffer.split(' ')
                            
                            if len(words) > 1:
                                for word in words[:-1]:
                                    yield word + ' '
                                    await asyncio.sleep(0.05)
                                word_buffer = words[-1]
                    
                    if word_buffer.strip():
                        yield word_buffer
                        
                except Exception as e:
                    yield f"❌ Chat Error: {str(e)}"
                    
            return StreamingResponse(llama_text_response(), media_type="text/plain")
            
    except Exception as error:
        print(f"❌ [FASTAPI] Fatal Error: {str(error)}")
        
        async def error_response():
            yield f"❌ Server Error: {str(error)}"
            
        return StreamingResponse(error_response(), media_type="text/plain")

# ✅ INTENT RECOGNITION ENDPOINT
class IntentRequest(BaseModel):
    message: str

class IntentResponse(BaseModel):
    intent: str

@app.post("/intent", response_model=IntentResponse)
async def intent_endpoint(request: IntentRequest):
    try:
        intent = await recognize_intent(request.message)
        return IntentResponse(intent=intent)
    except Exception as e:
        return IntentResponse(intent="general")

# ✅ ROOT ENDPOINT
@app.get("/")
def root():
    return {
        "message": "Nexus AI FastAPI Server",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "chat": "/chat",
            "intent": "/intent"
        }
    }

if __name__ == "__main__":
    import uvicorn

    print("="*60)
    print("🚀 Starting Nexus AI FastAPI Server...")
    print("📡 Main endpoint: POST /chat")
    print("🩺 Health check: GET /health")
    print("🎯 Supported types: text, document (image requires BLIP)")
    print("✅ Context window: 10 messages")
    print("="*60)

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except Exception as e:
        print(f"❌ [FASTAPI] Server failed to start: {str(e)}")
