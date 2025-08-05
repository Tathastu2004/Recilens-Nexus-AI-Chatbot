from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ValidationError
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from olloma import AsyncClient
import ollama
import json
from typing import Optional, Dict, Any, List
import uuid
from datetime import datetime
from blip_handler import generate_blip_response_stream, check_blip_health

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ SESSION MEMORY STORAGE
session_memory = {}  # sessionId -> conversation history

class ConversationMemory:
    def __init__(self):
        self.conversations = {}
    
    def add_message(self, session_id: str, role: str, content: str, message_type: str = "text", metadata: dict = None):
        if session_id not in self.conversations:
            self.conversations[session_id] = []
        
        message = {
            "id": str(uuid.uuid4()),
            "role": role,  # "user" or "assistant"
            "content": content,
            "type": message_type,  # "text", "image", "analysis"
            "model": "BLIP" if message_type == "image" else "Llama3",
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.conversations[session_id].append(message)
        
        # Keep only last 20 messages to prevent memory issues
        if len(self.conversations[session_id]) > 20:
            self.conversations[session_id] = self.conversations[session_id][-20:]
    
    def get_conversation(self, session_id: str) -> List[dict]:
        return self.conversations.get(session_id, [])
    
    def get_last_image_analysis(self, session_id: str) -> Optional[dict]:
        """Get the most recent image analysis from this session"""
        conversation = self.get_conversation(session_id)
        
        for message in reversed(conversation):
            if message["type"] == "image" and message["role"] == "assistant":
                return message
        return None
    
    def get_context_summary(self, session_id: str, max_messages: int = 5) -> str:
        """Get recent conversation context for Llama3"""
        conversation = self.get_conversation(session_id)
        if not conversation:
            return ""
        
        recent_messages = conversation[-max_messages:]
        context_parts = []
        
        for msg in recent_messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            model_info = f" ({msg['model']})" if msg["role"] == "assistant" else ""
            context_parts.append(f"{role}{model_info}: {msg['content']}")
        
        return "\n".join(context_parts)

# ✅ INITIALIZE MEMORY
memory = ConversationMemory()

# ✅ UPDATE CHAT REQUEST MODEL
class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = "chat"
    fileUrl: Optional[str] = None
    fileType: Optional[str] = None
    conversationContext: Optional[List[Dict[str, Any]]] = []

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        """Create ChatRequest from raw dict, handling extra fields gracefully"""
        valid_fields = {
            'prompt': data.get('prompt'),
            'message': data.get('message'), 
            'type': data.get('type', 'chat'),
            'fileUrl': data.get('fileUrl'),
            'fileType': data.get('fileType'),
            'conversationContext': data.get('conversationContext', [])
        }
        return cls(**{k: v for k, v in valid_fields.items() if v is not None})

# ✅ ENHANCED HEALTH CHECK
@app.get("/health")
async def health_check():
    try:
        print("🔍 [HEALTH] Checking services...")
        
        # ✅ CHECK OLLAMA
        ollama_status = {"connected": False, "llama3_available": False, "available_models": []}
        try:
            import httpx
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get("http://localhost:11434/api/tags")
                if response.status_code == 200:
                    ollama_data = response.json()
                    available_models = [model.get("name", "") for model in ollama_data.get("models", [])]
                    llama3_available = any("llama3" in model.lower() for model in available_models)
                    ollama_status = {
                        "connected": True,
                        "llama3_available": llama3_available,
                        "available_models": available_models
                    }
        except Exception as e:
            ollama_status["error"] = str(e)
        
        # ✅ CHECK BLIP
        blip_status = {"connected": False, "status": "unknown"}
        try:
            blip_working, blip_message = check_blip_health()
            blip_status = {
                "connected": blip_working,
                "status": blip_message,
                "device": str(device) if 'device' in globals() else "unknown"
            }
        except Exception as e:
            blip_status = {
                "connected": False,
                "status": f"BLIP check failed: {str(e)}"
            }
        
        # ✅ OVERALL STATUS
        overall_status = "ok" if ollama_status["connected"] and blip_status["connected"] else "partial"
        
        return {
            "status": overall_status,
            "message": "FastAPI is running",
            "services": {
                "ollama": ollama_status,
                "blip": blip_status
            },
            "supported_types": ["chat", "image"]
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": "Health check failed",
            "error": str(e)
        }

@app.post("/test")
async def test_endpoint(request: Request):
    try:
        raw_body = await request.body()
        json_data = json.loads(raw_body) if raw_body else {}
        print(f"🔍 [TEST] Received: {json.dumps(json_data, indent=2)}")
        return {"received": json_data, "status": "ok", "body_length": len(raw_body)}
    except Exception as e:
        return {"error": str(e), "status": "error"}

@app.post("/debug")
async def debug_request(request: Request):
    try:
        raw_body = await request.body()
        headers = dict(request.headers)
        json_data = json.loads(raw_body) if raw_body else {}
        
        debug_info = {
            "raw_body": raw_body.decode('utf-8'),
            "json_data": json_data,
            "headers": headers,
            "method": request.method,
            "url": str(request.url)
        }
        
        print(f"🔍 [DEBUG] Full request info: {json.dumps(debug_info, indent=2)}")
        return debug_info
    except Exception as e:
        return {"error": str(e), "raw_body": raw_body.decode('utf-8') if raw_body else None}

# ✅ UPDATED CHAT ROUTE WITH BETTER CONTEXT PROCESSING
@app.post("/chat")
async def unified_chat_route(request: Request):
    try:
        # Parse request
        body = await request.json()
        chat_request = ChatRequest.from_dict(body)
        
        user_message = chat_request.message or chat_request.prompt or ""
        request_type = chat_request.type or "chat"
        file_url = chat_request.fileUrl
        session_id = body.get("sessionId", "default")
        conversation_context = chat_request.conversationContext or []
        
        print(f"📨 [FASTAPI] Unified chat request:")
        print(f"   - Session: {session_id}")
        print(f"   - Message: {user_message[:50]}...")
        print(f"   - Type: {request_type}")
        print(f"   - File: {file_url is not None}")
        print(f"   - Context Messages: {len(conversation_context)}")
        
        # ✅ ENHANCED CONTEXT PROCESSING - BUILD CONVERSATION HISTORY
        enhanced_context = ""
        last_image_analysis = None
        
        if conversation_context:
            print(f"📚 [FASTAPI] Processing {len(conversation_context)} context messages...")
            
            # Build conversation history and find last image analysis
            conversation_history = []
            
            for i, ctx_msg in enumerate(conversation_context):
                role = ctx_msg.get('role', 'user')
                content = ctx_msg.get('content', '')
                msg_type = ctx_msg.get('type', 'text')
                file_url_ctx = ctx_msg.get('fileUrl')
                
                # Track the last image analysis
                if (file_url_ctx or msg_type == 'image') and role == 'assistant':
                    last_image_analysis = {
                        'content': content,
                        'fileUrl': file_url_ctx,
                        'index': i
                    }
                    print(f"🖼️ [FASTAPI] Found image analysis at index {i}: {content[:100]}...")
                
                # Add to conversation history
                if content.strip():
                    conversation_history.append(f"{role.title()}: {content}")
            
            # Build enhanced context
            if conversation_history:
                enhanced_context = "Previous conversation:\n" + "\n".join(conversation_history[-10:]) + "\n\n"
                print(f"📝 [FASTAPI] Built conversation context with {len(conversation_history)} messages")
        
        # ✅ CHECK FOR REFERENCE TO PREVIOUS IMAGE/ANALYSIS
        reference_keywords = [
            "again", "analysis", "image", "picture", "describe again", "what did you see",
            "tell me again", "repeat", "previous", "above", "that photo", "detail",
            "give analysis", "analyze again", "what was in", "explain again"
        ]
        
        is_asking_about_previous = any(keyword in user_message.lower() for keyword in reference_keywords)
        
        if request_type == "chat" and is_asking_about_previous and last_image_analysis:
            print(f"🔄 [FASTAPI] User asking about previous analysis, enhancing context...")
            
            enhanced_message = f"""{enhanced_context}The user previously uploaded an image and received this analysis: "{last_image_analysis['content']}"

Now the user is asking: "{user_message}"

Please respond based on the previous image analysis. If they're asking for the analysis again or for more details, provide information based on what was already analyzed."""

            user_message = enhanced_message
            print(f"✅ [FASTAPI] Enhanced message with previous image context")
            
        elif request_type == "chat" and enhanced_context:
            # Just add conversation context without specific image reference
            user_message = enhanced_context + "Current user message: " + user_message
            print(f"📚 [FASTAPI] Added general conversation context")
        
        # ✅ AUTO-DETECT IMAGE TYPE
        if file_url and any(ext in file_url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
            request_type = "image"
            print(f"🖼️ [FASTAPI] Auto-detected image from URL, switching to BLIP")
        
        # ✅ STORE USER MESSAGE IN MEMORY
        memory.add_message(session_id, "user", user_message, 
                          "image" if file_url else "text", 
                          {"file_url": file_url})
        
        # ✅ ROUTE TO APPROPRIATE MODEL
        if request_type == "image":
            print(f"🖼️ [FASTAPI] Routing to BLIP handler...")
            
            async def blip_response_generator():
                try:
                    response_content = ""
                    async for chunk in generate_blip_response_stream(user_message, file_url):
                        response_content += chunk
                        yield chunk
                    
                    # ✅ STORE BLIP RESPONSE
                    memory.add_message(session_id, "assistant", response_content, "image", 
                                     {"file_url": file_url, "model": "BLIP"})
                    
                except Exception as e:
                    error_msg = f"❌ BLIP Error: {str(e)}"
                    print(f"❌ [BLIP] Error: {error_msg}")
                    yield error_msg
            
            return StreamingResponse(
                blip_response_generator(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"
                }
            )
        
        elif request_type == "chat":
            print(f"🦙 [FASTAPI] Routing to Llama3 handler...")
            
            try:
                async def llama_response_generator():
                    try:
                        client = AsyncClient(host='http://127.0.0.1:11434')
                        
                        # ✅ ENHANCED SYSTEM PROMPT FOR CONTEXT AWARENESS
                        system_prompt = """You are a helpful AI assistant with access to conversation history. 

IMPORTANT INSTRUCTIONS:
- You have access to previous conversation context including image analyses from BLIP model
- When users ask to "repeat", "again", "give analysis again", or refer to previous content, use the provided context
- If a user asks about a previous image analysis, provide the information from the context
- Don't say "this conversation just started" if context is provided
- Be conversational and reference previous interactions when relevant"""

                        stream = await client.chat(
                            model='llama3',
                            messages=[
                                {
                                    'role': 'system',
                                    'content': system_prompt
                                },
                                {
                                    'role': 'user',
                                    'content': user_message
                                }
                            ],
                            stream=True
                        )
                        
                        response_content = ""
                        chunk_count = 0
                        
                        async for chunk in stream:
                            content = chunk.get('message', {}).get('content', '')
                            if content:
                                chunk_count += 1
                                response_content += content
                                yield content
                        
                        # ✅ STORE LLAMA3 RESPONSE
                        memory.add_message(session_id, "assistant", response_content, "text", 
                                         {"model": "Llama3"})
                        
                        print(f"✅ [LLAMA3] Response completed. Chunks: {chunk_count}")
                        print(f"📝 [LLAMA3] Response preview: {response_content[:100]}...")
                        
                    except Exception as e:
                        error_msg = f"❌ Llama3 Error: {str(e)}"
                        print(f"❌ [LLAMA3] Error: {error_msg}")
                        yield error_msg
                
                return StreamingResponse(
                    llama_response_generator(),
                    media_type="text/plain",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Accel-Buffering": "no"
                    }
                )
            
            except Exception as ollama_error:
                print(f"❌ [FASTAPI] Ollama connection error: {ollama_error}")
                raise HTTPException(
                    status_code=503,
                    detail=f"Ollama service unavailable: {str(ollama_error)}"
                )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported request type: {request_type}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [FASTAPI] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ✅ NEW ENDPOINT: GET SESSION MEMORY
@app.get("/session/{session_id}/memory")
async def get_session_memory(session_id: str):
    """Get conversation history for a session"""
    conversation = memory.get_conversation(session_id)
    return {
        "session_id": session_id,
        "message_count": len(conversation),
        "messages": conversation
    }

# ✅ NEW ENDPOINT: CLEAR SESSION MEMORY
@app.delete("/session/{session_id}/memory")
async def clear_session_memory(session_id: str):
    """Clear conversation history for a session"""
    if session_id in memory.conversations:
        del memory.conversations[session_id]
    return {"message": f"Session {session_id} memory cleared"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FastAPI server...")
    print("📡 Endpoints available:")
    print("   - POST /chat (AI chat with type-based routing)")
    print("   - GET /health (Health check)")
    print("   - POST /debug (Debug requests)")
    print("   - POST /test (Simple test)")
    print("")
    print("🎯 Supported request types:")
    print("   - 'chat' → Llama3 (text responses)")
    print("   - 'image' → BLIP (image analysis)")
    print("   - Auto-detection based on fileType")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
