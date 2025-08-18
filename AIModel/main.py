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

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

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

# ✅ SIMPLIFIED CHAT REQUEST MODEL
class ChatRequest(BaseModel):
    message: Optional[str] = None
    type: Optional[str] = "text"
    fileUrl: Optional[str] = None
    fileType: Optional[str] = None
    fileName: Optional[str] = None
    extractedText: Optional[str] = None  # ✅ TEXT FROM NODE.JS BACKEND
    conversationContext: Optional[List[Dict[str, Any]]] = []
    sessionId: Optional[str] = None

def generate_session_id():
    return str(uuid.uuid4())

# ✅ HEALTH CHECK
@app.get("/health")
async def health_check():
    blip_ok = False
    llama_ok = False
    # Check BLIP
    try:
        r = requests.get("http://127.0.0.1:5001/health", timeout=2)
        blip_ok = r.status_code == 200 and r.json().get("ok", False)
    except Exception:
        blip_ok = False
    # Check Llama (Ollama)
    try:
        r = requests.get("http://127.0.0.1:11434/health", timeout=2)
        llama_ok = r.status_code == 200
    except Exception:
        llama_ok = False
    return {
        "status": "ok",
        "message": "FastAPI is running",
        "services": {
            "ollama": {"connected": llama_ok},
            "blip": {"connected": blip_ok}
        },
        "supported_types": ["text", "image", "document", "training"]
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
        extracted_text = request.extractedText  # ✅ TEXT FROM NODE.JS BACKEND
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
                        client = AsyncClient(host='http://127.0.0.1:11434')
                        
                        # ✅ ENHANCED PROMPT WITH EXTRACTED TEXT
                        enhanced_prompt = f"""DOCUMENT CONTENT:
{extracted_text}

DOCUMENT INFO:
- File Name: {file_name or 'Unknown'}
- File Type: {file_type or 'Unknown'}
- Content Length: {len(extracted_text)} characters

USER REQUEST: {user_message}

INSTRUCTIONS: Analyze the document content above and respond to the user's request."""

                        print(f"📝 [LLAMA3] Processing with enhanced prompt (length: {len(enhanced_prompt)} chars)...")
                        print(f"📝 [LLAMA3] Prompt preview: {enhanced_prompt[:200]}...")
                        
                        stream = await client.chat(
                            model='llama3',
                            messages=[
                                {'role': 'system', 'content': 'You are a helpful document analysis assistant. Analyze the provided document content and respond to user questions.'},
                                {'role': 'user', 'content': enhanced_prompt}
                            ],
                            stream=True
                        )
                        
                        print(f"🌊 [LLAMA3] Starting to stream response...")
                        response_content = ""
                        chunk_count = 0
                        
                        async for chunk in stream:
                            content = chunk.get('message', {}).get('content', '')
                            if content:
                                response_content += content
                                chunk_count += 1
                                yield content
                                
                                # Debug every 10 chunks
                                if chunk_count % 10 == 0:
                                    print(f"🌊 [LLAMA3] Streaming progress: {chunk_count} chunks, {len(response_content)} characters")
                        
                        print(f"✅ [LLAMA3] Streaming completed: {chunk_count} chunks, {len(response_content)} characters")
                        
                        # ✅ STORE RESPONSE IN MEMORY
                        memory.add_message(session_id, "assistant", response_content, "document", {
                            "model": "Llama3",
                            "used_extracted_text": True,
                            "text_length": len(extracted_text),
                            "file_name": file_name,
                            "chunks_streamed": chunk_count
                        })
                        
                        print(f"✅ [FASTAPI] Document processing completed successfully")
                        
                    except Exception as e:
                        error_msg = f"❌ Document Processing Error: {str(e)}"
                        print(f"❌ [LLAMA3] Document processing failed: {error_msg}")
                        print(f"❌ [LLAMA3] Error type: {type(e).__name__}")
                        print(f"❌ [LLAMA3] Error details: {str(e)}")
                        yield error_msg
                
                # ✅ STORE USER MESSAGE
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
        
        # ✅ IMAGE PROCESSING - FIXED
        elif request_type == "image":
            print(f"🖼️ [FASTAPI] Image analysis request...")
            print(f"🖼️ [FASTAPI] Image URL: {file_url}")
            
            async def blip_response():
                try:
                    print(f"📡 [BLIP] Sending request to BLIP server...")
                    
                    # ✅ FIX: Use correct request payload format
                    # Don't send filename as question - let BLIP generate a caption
                    payload = {
                        "image_url": file_url,
                        "question": user_message if user_message and not user_message.startswith("Uploaded image:") else None
                    }
                    
                    # ✅ FIX: Add proper headers
                    headers = {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }
                    
                    print(f"📡 [BLIP] Request payload: {payload}")
                    print(f"📡 [BLIP] Request headers: {headers}")
                    print(f"📡 [BLIP] Target URL: http://127.0.0.1:5001/analyze")
                    
                    # ✅ FIX: Check if BLIP server is running first
                    try:
                        health_check = requests.get("http://127.0.0.1:5001/health", timeout=5)
                        print(f"📡 [BLIP] Health check: {health_check.status_code}")
                        if health_check.status_code != 200:
                            yield "❌ BLIP server is not healthy. Please restart the BLIP service."
                            return
                    except requests.exceptions.ConnectionError:
                        yield "❌ Cannot connect to BLIP server. Please make sure it's running on port 5001."
                        return
                    
                    blip_response = requests.post(
                        "http://127.0.0.1:5001/analyze", 
                        json=payload,
                        headers=headers,
                        timeout=60
                    )
                    
                    print(f"📥 [BLIP] BLIP response: {blip_response.status_code}")
                    
                    if blip_response.status_code == 200:
                        result = blip_response.json()
                        content = result.get('result', 'Image analysis completed')
                        
                        print(f"✅ [BLIP] Analysis successful: {content[:100]}...")
                        
                        memory.add_message(session_id, "user", user_message, "image", {"file_url": file_url})
                        memory.add_message(session_id, "assistant", content, "image", {"model": "BLIP"})
                        
                        yield content
                        print(f"✅ [BLIP] Image analysis completed")
                    else:
                        error_msg = f"❌ BLIP Error: HTTP {blip_response.status_code}"
                        if blip_response.text:
                            error_msg += f" - {blip_response.text}"
                        print(f"❌ [BLIP] Error: {error_msg}")
                        yield error_msg
                        
                except requests.exceptions.ConnectionError:
                    error_msg = "❌ Cannot connect to BLIP server. Make sure it's running on port 5000."
                    print(f"❌ [BLIP] Connection Error: {error_msg}")
                    yield error_msg
                except requests.exceptions.Timeout:
                    error_msg = "❌ BLIP server timeout. Image analysis took too long."
                    print(f"❌ [BLIP] Timeout Error: {error_msg}")
                    yield error_msg
                except Exception as e:
                    error_msg = f"❌ Image Analysis Error: {str(e)}"
                    print(f"❌ [BLIP] Exception: {error_msg}")
                    yield error_msg
            
            return StreamingResponse(blip_response(), media_type="text/plain")
        
        # ✅ TEXT CHAT
        else:  # text
            print(f"🦙 [FASTAPI] Text chat request...")
            
            async def llama_response():
                try:
                    print(f"🦙 [LLAMA3] Connecting to Ollama for text chat...")
                    client = AsyncClient(host='http://127.0.0.1:11434')
                    
                    print(f"🦙 [LLAMA3] Starting chat with message: {user_message[:100]}...")
                    
                    stream = await client.chat(
                        model='llama3',
                        messages=[
                            {'role': 'system', 'content': 'You are a helpful AI assistant.'},
                            {'role': 'user', 'content': user_message}
                        ],
                        stream=True
                    )
                    
                    print(f"🌊 [LLAMA3] Starting text response stream...")
                    response_content = ""
                    chunk_count = 0
                    
                    async for chunk in stream:
                        content = chunk.get('message', {}).get('content', '')
                        if content:
                            response_content += content
                            chunk_count += 1
                            yield content
                    
                    print(f"✅ [LLAMA3] Text response completed: {chunk_count} chunks, {len(response_content)} chars")
                    
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
    
# ✅ TRAINING REQUEST MODEL
class TrainingRequest(BaseModel):
    jobId: str
    modelName: str
    dataset: str
    parameters: Optional[Dict[str, Any]] = None

@app.post("/train")
async def train_model(req: TrainingRequest):
    """
    This is called from Node.js when training is started.
    - jobId is always generated in Node (Mongo _id)
    - FastAPI just runs the job and sends updates back to Node
    """
    job_id = req.jobId
    model_name = req.modelName
    dataset = req.dataset
    params = req.parameters or {}

    print(f"🚀 [TRAINING] Job started")
    print(f"   jobId: {job_id}")
    print(f"   model: {model_name}")
    print(f"   dataset: {dataset}")
    print(f"   params: {params}")

    async def training_process():
        try:
            # 🔄 Step 1: Notify Node that training started
            requests.post("http://localhost:3000/api/training/update", json={
                "jobId": job_id,
                "status": "running",
                "log": f"Training started for model {model_name}"
            })

            # 🔄 Step 2: Fake long-running training (replace with real ML loop)
            for epoch in range(1, 6):
                await asyncio.sleep(2)  # simulate training work
                log_msg = f"Epoch {epoch}/5 completed"
                print(f"📝 [TRAINING] {log_msg}")

                requests.post("http://localhost:3000/api/training/update", json={
                    "jobId": job_id,
                    "status": "running",
                    "log": log_msg,
                    "progress": epoch * 20
                })

            # 🔄 Step 3: Final result
            accuracy = 0.92
            final_log = f"Training completed with accuracy {accuracy:.2f}"
            print(f"✅ [TRAINING] {final_log}")

            requests.post("http://localhost:3000/api/training/update", json={
                "jobId": job_id,
                "status": "completed",
                "log": final_log,
                "accuracy": accuracy
            })

        except Exception as e:
            err_msg = f"Training failed: {str(e)}"
            print(f"❌ [TRAINING] {err_msg}")
            requests.post("http://localhost:3000/api/training/update", json={
                "jobId": job_id,
                "status": "failed",
                "log": err_msg
            })

    asyncio.create_task(training_process())

    return {"ok": True, "jobId": job_id, "message": "Training started"}    


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