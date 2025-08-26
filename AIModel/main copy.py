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
from models.training_models import (
    TrainingRequest, CancelRequest, ModelLoadRequest, 
    ModelUnloadRequest, ModelStatusResponse
)
from services.training_service import TrainingService
from services.model_manager import ModelManager
from config.training_config import TrainingConfig
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
from ollama_client import recognize_intent

# Add logging configuration
logging.basicConfig(level=TrainingConfig.LOG_LEVEL)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ SESSION MEMORY STORAGE
class ConversationMemory:
    def __init__(self):
        self.conversations = {}
    
    def add_message(self, session_id: str, role: str, content: str, message_type: str = "text", metadata: dict = None):
        if session_id not in self.conversations:
            self.conversations[session_id] = []
        
        message = {
            "id": str(uuid.uuid4()),
            "role": role,
            "content": content,
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.conversations[session_id].append(message)
        
        # Keep only last 20 messages
        if len(self.conversations[session_id]) > 20:
            self.conversations[session_id] = self.conversations[session_id][-20:]
    
    def get_conversation(self, session_id: str) -> List[dict]:
        return self.conversations.get(session_id, [])

# Initialize memory
memory = ConversationMemory()

# Initialize services
training_service = TrainingService(TrainingConfig.NODE_BACKEND_URL)
model_manager = ModelManager()

# Ensure model directories exist
TrainingConfig.ensure_model_directories()

# ✅ SIMPLIFIED CHAT REQUEST MODEL
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

# Enhanced health check endpoint
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
    
    # Check BLIP Service
    start_time = datetime.now()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BLIP_URL}/health", timeout=5) as response:
                response_time = (datetime.now() - start_time).total_seconds() * 1000
                blip_data = await response.json()
                health_status["services"]["blip"] = {
                    "status": "online" if response.status == 200 else "offline",
                    "response_time_ms": round(response_time, 2),
                    "connected": blip_data.get("ok", False),
                    "last_checked": datetime.now().isoformat()
                }
    except aiohttp.ClientTimeout:
        health_status["services"]["blip"] = {
            "status": "timeout",
            "error": "Service timeout after 5 seconds",
            "last_checked": datetime.now().isoformat()
        }
    except aiohttp.ClientConnectorError:
        health_status["services"]["blip"] = {
            "status": "offline",
            "error": "Cannot connect to BLIP service",
            "last_checked": datetime.now().isoformat()
        }
    except Exception as e:
        health_status["services"]["blip"] = {
            "status": "error",
            "error": str(e),
            "last_checked": datetime.now().isoformat()
        }
    
    # Check Ollama (Llama) Service
    start_time = datetime.now()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{LLAMA_URL}/api/version", timeout=5) as response:
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
    except Exception as e:
        health_status["services"]["llama"] = {
            "status": "offline",
            "error": str(e),
            "connected": False,
            "last_checked": datetime.now().isoformat()
        }
    
    # Check database connection (simulated)
    start_time = datetime.now()
    try:
        response_time = 10  # Simulated response time
        health_status["services"]["database"] = {
            "status": "online",
            "response_time_ms": response_time,
            "connected": True,
            "type": "mongodb",
            "last_checked": datetime.now().isoformat()
        }
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "offline",
            "error": str(e),
            "connected": False,
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

# Add models health endpoints
@app.get("/models/llama/health")
async def llama_health():
    """Llama model specific health check"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{LLAMA_URL}/api/version", timeout=3) as response:
                if response.status == 200:
                    return {
                        "status": "online",
                        "loaded": True,
                        "model": "Llama3",
                        "service": "Ollama",
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    return {
                        "status": "offline",
                        "loaded": False,
                        "timestamp": datetime.now().isoformat()
                    }
    except Exception as e:
        return {
            "status": "error",
            "loaded": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/models/blip/health")
async def blip_health():
    """BLIP model specific health check"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BLIP_URL}/health", timeout=3) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "status": "online",
                        "loaded": data.get("ok", False),
                        "model": "BLIP",
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    return {
                        "status": "offline",
                        "loaded": False,
                        "timestamp": datetime.now().isoformat()
                    }
    except Exception as e:
        return {
            "status": "error",
            "loaded": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ✅ MAIN CHAT ROUTE - HANDLES ALL TYPES
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    print("🚀 [FASTAPI] ==================== CHAT REQUEST RECEIVED ====================")
    print(f"📥 [FASTAPI] Request details:")
    print(f"   Session: {request.sessionId[:8] if request.sessionId else 'None'}...")
    print(f"   Type: {request.type}")
    print(f"   Message: {request.message[:50] if request.message else 'None'}...")
    print(f"   Has File: {bool(request.fileUrl)}")
    print(f"   File Type: {request.fileType}")
    print(f"   File Name: {request.fileName}")
    print(f"   Has Pre-extracted Text: {bool(request.extractedText)}")
    print(f"   Extracted Text Length: {len(request.extractedText) if request.extractedText else 0}")
    if request.extractedText:
        print(f"   Extracted Text Preview: {request.extractedText[:200]}...")
    
    try:
        session_id = request.sessionId or generate_session_id()
        user_message = request.message or ""
        file_url = request.fileUrl
        file_type = request.fileType
        file_name = request.fileName
        extracted_text = request.extractedText
        request_type = request.type or "text"

        print(f"🔍 [FASTAPI] Processing parameters:")
        print(f"   Request Type: {request_type}")
        print(f"   Will use extracted text: {bool(extracted_text and len(extracted_text.strip()) > 10)}")
        
        # ✅ DOCUMENT PROCESSING WITH PRE-EXTRACTED TEXT
        if request_type == "document":
            print(f"📄 [FASTAPI] Document processing request...")
            
            if extracted_text and len(extracted_text.strip()) > 10:
                print(f"✅ [FASTAPI] Using pre-extracted text from Node.js backend")
                print(f"   Text length: {len(extracted_text)} characters")
                print(f"   Text preview: {extracted_text[:100]}...")
                
                async def llama_with_extracted_text():
                    try:
                        print(f"🦙 [LLAMA3] Connecting to Ollama...")
                        client = AsyncClient(host=LLAMA_URL)
                        
                        enhanced_prompt = f"""DOCUMENT CONTENT:
{extracted_text}

DOCUMENT INFO:
- File Name: {file_name or 'Unknown'}
- File Type: {file_type or 'Unknown'}
- Content Length: {len(extracted_text)} characters

USER REQUEST: {user_message}

INSTRUCTIONS: Analyze the document content above and respond to the user's request."""

                        print(f"📝 [LLAMA3] Processing with enhanced prompt...")
                        
                        stream = await client.chat(
                            model='llama3',
                            messages=[
                                {'role': 'system', 'content': 'You are a helpful document analysis assistant. Analyze the provided document content and respond to user questions.'},
                                {'role': 'user', 'content': enhanced_prompt}
                            ],
                            stream=True
                        )
                        
                        print(f"🌊 [LLAMA3] Starting word-by-word document response stream...")
                        response_content = ""
                        chunk_count = 0
                        word_buffer = ""
                        
                        async for chunk in stream:
                            content = chunk.get('message', {}).get('content', '')
                            if content:
                                response_content += content
                                chunk_count += 1
                                word_buffer += content
                                
                                # Split by spaces to get words
                                words = word_buffer.split(' ')
                                
                                if len(words) > 1:
                                    for word in words[:-1]:
                                        yield word + ' '
                                        await asyncio.sleep(0.05)
                                    word_buffer = words[-1]
                        
                        if word_buffer.strip():
                            yield word_buffer
                        
                        print(f"✅ [LLAMA3] Document streaming completed: {chunk_count} chunks, {len(response_content)} characters")
                        
                        memory.add_message(session_id, "assistant", response_content, "document", {
                            "model": "Llama3",
                            "used_extracted_text": True,
                            "text_length": len(extracted_text),
                            "file_name": file_name,
                            "chunks_streamed": chunk_count
                        })
                        
                    except Exception as e:
                        error_msg = f"❌ Document Processing Error: {str(e)}"
                        print(f"❌ [LLAMA3] Document processing failed: {error_msg}")
                        yield error_msg
                
                memory.add_message(session_id, "user", user_message, "document", {
                    "file_url": file_url,
                    "file_type": file_type,
                    "file_name": file_name,
                    "extracted_text_length": len(extracted_text)
                })
                
                print(f"🌊 [FASTAPI] Starting StreamingResponse for document...")
                return StreamingResponse(llama_with_extracted_text(), media_type="text/plain")
            
            else:
                print(f"❌ [FASTAPI] No extracted text provided from backend!")
                async def error_response():
                    error_msg = "❌ Document Processing Error: No extracted text provided from backend."
                    yield error_msg
                
                return StreamingResponse(error_response(), media_type="text/plain")
        
        # ✅ IMAGE PROCESSING
        elif request_type == "image":
            print(f"🖼️ [FASTAPI] Image analysis request...")
            print(f"🖼️ [FASTAPI] Image URL: {file_url}")

            async def blip_response():
                try:
                    print(f"📡 [BLIP] Sending request to BLIP server...")

                    payload = {
                        "image_url": file_url,
                        "question": user_message if user_message and not user_message.startswith("Uploaded image:") else None
                    }

                    headers = {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }

                    print(f"📡 [BLIP] Request payload: {payload}")

                    # Check BLIP server health
                    try:
                        health_check = requests.get(f"{BLIP_URL}/health", timeout=5)
                        if health_check.status_code != 200:
                            yield "❌ BLIP server is not healthy. Please restart the BLIP service."
                            return
                    except requests.exceptions.ConnectionError:
                        yield "❌ Cannot connect to BLIP server. Please make sure it's running on port 5001."
                        return

                    blip_response = requests.post(
                        f"{BLIP_URL}/analyze",
                        json=payload,
                        headers=headers,
                        timeout=60
                    )

                    print(f"📥 [BLIP] BLIP response: {blip_response.status_code}")

                    if blip_response.status_code == 200:
                        result = blip_response.json()
                        content = result.get('result', 'Image analysis completed')

                        print(f"✅ [BLIP] Analysis successful: {content[:100]}...")

                        # ✅ WORD-BY-WORD STREAMING FOR BLIP RESPONSE
                        print(f"🌊 [BLIP] Starting word-by-word streaming...")
                        words = content.split(' ')
                        print(f"📊 [BLIP] Will stream {len(words)} words")

                        for i, word in enumerate(words):
                            word_to_send = word if i == len(words) - 1 else word + ' '
                            print(f"📝 [BLIP WORD {i+1}/{len(words)}] Sending: '{word_to_send}'")
                            yield word_to_send
                            await asyncio.sleep(0.08)  # 80ms delay for images

                        memory.add_message(session_id, "user", user_message, "image", {"file_url": file_url})
                        memory.add_message(session_id, "assistant", content, "image", {"model": "BLIP"})

                        print(f"✅ [BLIP] Word-by-word image analysis completed")
                    else:
                        error_msg = f"❌ BLIP Error: HTTP {blip_response.status_code}"
                        if blip_response.text:
                            error_msg += f" - {blip_response.text}"
                        print(f"❌ [BLIP] Error: {error_msg}")

                        words = error_msg.split(' ')
                        for i, word in enumerate(words):
                            yield word + (' ' if i < len(words) - 1 else '')
                            await asyncio.sleep(0.05)

                except requests.exceptions.ConnectionError:
                    error_msg = "❌ Cannot connect to BLIP server. Make sure it's running on port 5001."
                    print(f"❌ [BLIP] Connection Error: {error_msg}")
                    words = error_msg.split(' ')
                    for i, word in enumerate(words):
                        yield word + (' ' if i < len(words) - 1 else '')
                        await asyncio.sleep(0.05)
                except requests.exceptions.Timeout:
                    error_msg = "❌ BLIP server timeout. Image analysis took too long."
                    print(f"❌ [BLIP] Timeout Error: {error_msg}")
                    words = error_msg.split(' ')
                    for i, word in enumerate(words):
                        yield word + (' ' if i < len(words) - 1 else '')
                        await asyncio.sleep(0.05)
                except Exception as e:
                    error_msg = f"❌ Image Analysis Error: {str(e)}"
                    print(f"❌ [BLIP] Exception: {error_msg}")
                    words = error_msg.split(' ')
                    for i, word in enumerate(words):
                        yield word + (' ' if i < len(words) - 1 else '')
                        await asyncio.sleep(0.05)

            return StreamingResponse(blip_response(), media_type="text/plain")

        # ✅ TEXT CHAT - CORRECTED
        else:
            print(f"🦙 [FASTAPI] Text chat request...")

            async def llama_response():
                try:
                    print(f"🦙 [LLAMA3] Connecting to Ollama for text chat...")
                    client = AsyncClient(host=LLAMA_URL)

                    print(f"🦙 [LLAMA3] Starting chat with message: {user_message[:100]}...")

                    stream = await client.chat(
                        model='llama3',
                        messages=[
                            {'role': 'system', 'content': 'You are a helpful AI assistant.'},
                            {'role': 'user', 'content': user_message}
                        ],
                        stream=True
                    )

                    print(f"🌊 [LLAMA3] Starting ENHANCED word-by-word streaming with detailed logging...")
                    response_content = ""
                    chunk_count = 0
                    word_count = 0
                    word_buffer = ""

                    async for chunk in stream:
                        content = chunk.get('message', {}).get('content', '')
                        if content:
                            response_content += content
                            chunk_count += 1
                            word_buffer += content

                            # ✅ LOG RAW CHUNK DATA
                            print(f"📦 [CHUNK {chunk_count}] Raw: '{content}' (len: {len(content)})")

                            # Split by spaces to get words
                            words = word_buffer.split(' ')

                            # Send complete words (keep last incomplete word in buffer)
                            if len(words) > 1:
                                for word in words[:-1]:
                                    word_count += 1
                                    word_with_space = word + ' '

                                    # ✅ DETAILED WORD LOGGING
                                    print(f"📝 [WORD {word_count}] Sending: '{word_with_space}' (len: {len(word_with_space)})")

                                    yield word_with_space
                                    await asyncio.sleep(0.05)  # 50ms delay between words

                                # Keep the last word in buffer
                                word_buffer = words[-1]
                                print(f"🔄 [BUFFER] Remaining: '{word_buffer}'")
                    
                    # Send any remaining content in buffer
                    if word_buffer.strip():
                        word_count += 1
                        print(f"📝 [FINAL WORD] Sending: '{word_buffer}' (len: {len(word_buffer)})")
                        yield word_buffer

                    print(f"✅ [LLAMA3] STREAMING SUMMARY:")
                    print(f"   Total chunks: {chunk_count}")
                    print(f"   Total words sent: {word_count}")
                    print(f"   Total characters: {len(response_content)}")
                    print(f"   Full response: {response_content[:200]}...")

                    memory.add_message(session_id, "user", user_message, "text")
                    memory.add_message(session_id, "assistant", response_content, "text", {"model": "Llama3"})

                except Exception as e:
                    error_msg = f"❌ Llama3 Error: {str(e)}"
                    print(f"❌ [LLAMA3] Error: {error_msg}")
                    yield error_msg

            return StreamingResponse(llama_response(), media_type="text/plain")

    except Exception as error:
        print(f"❌ [FASTAPI] ==================== FATAL ERROR ====================")
        print(f"❌ [FASTAPI] Error name: {type(error).__name__}")
        print(f"❌ [FASTAPI] Error message: {str(error)}")
        print(f"❌ [FASTAPI] Error details: {repr(error)}")

        async def error_generator():
            yield f"❌ Server Error: {str(error)}"

        return StreamingResponse(error_generator(), media_type="text/plain")

# ... rest of your endpoints remain the same ...

@app.post("/train")
async def train_model(req: TrainingRequest):
    """Enhanced training endpoint with proper service integration"""
    try:
        logger.info(f"Training job started: {req.jobId}")
        
        asyncio.create_task(
            training_service.start_training(
                req.jobId, 
                req.modelName, 
                req.dataset, 
                req.parameters
            )
        )
        
        return {
            "ok": True, 
            "jobId": req.jobId, 
            "message": "Training started successfully"
        }
        
    except Exception as e:
        logger.error(f"Training start failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start training: {str(e)}")

# Intent recognition endpoint
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
        raise HTTPException(status_code=500, detail=f"Intent recognition failed: {str(e)}")

# ✅ MAIN SERVER STARTUP
if __name__ == "__main__":
    import uvicorn

    print("="*60)
    print("🚀 Starting FastAPI server...")
    print("📡 Endpoint: POST /chat")
    print("🎯 Supported types: text, image, document")
    print("✅ [FASTAPI] Backend text extraction integration enabled")
    print("="*60)

    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
        print("✅ [FASTAPI] Server is READY and listening for requests!")
        print("✅ [LLAMA] Llama (Ollama) integration is READY!")
        print("✅ [BLIP] BLIP integration is READY (make sure BLIP server is running)!")
    except Exception as e:
        print("❌ [FASTAPI] Server failed to start:", str(e))
