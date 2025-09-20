# main.py - FIXED VERSION
import asyncio
import os
import logging
import uuid
import psutil
import aiohttp
import json
from pathlib import Path
from datetime import datetime
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ollama import AsyncClient
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

# ✅ Add error handling for optional services
try:
    from services.lora_trainer import LoRATrainer
    from services.inference_service import LoRAInferenceService
    from services.model_manager import ModelManager
    from services.training_service import TrainingService
    from config.training_config import TrainingConfig
    HAS_LORA_SERVICES = True
except ImportError as e:
    print(f"⚠️ Warning: Could not import LoRA services: {e}")
    print("📝 Some LoRA features may not work until services are implemented")
    HAS_LORA_SERVICES = False

load_dotenv()

# Load environment variables
LLAMA_URL = os.getenv("LLAMA_URL", "http://127.0.0.1:11434")
BLIP_URL = os.getenv("BLIP_URL", "http://127.0.0.1:5001")
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:3000")

# Initialize services with error handling
if HAS_LORA_SERVICES:
    try:
        training_service = TrainingService(backend_url=NODE_BACKEND_URL)
        model_manager = ModelManager()
        TrainingConfig.ensure_model_directories()
    except Exception as e:
        print(f"⚠️ Warning: Could not initialize services: {e}")
        training_service = None
        model_manager = None
else:
    training_service = None
    model_manager = None

# Add logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nexus AI FastAPI Server", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ FIXED: PYDANTIC MODELS DEFINED FIRST
class ChatMessage(BaseModel):
    role: str
    content: str
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileType: Optional[str] = None

class ChatRequest(BaseModel):
    sessionId: str
    message: str
    type: Optional[str] = "text"
    conversation_context: Optional[List[ChatMessage]] = []
    adapter_id: Optional[str] = None

class EnhancedChatRequest(BaseModel):
    sessionId: str
    message: str
    type: Optional[str] = "text"
    conversation_context: Optional[List[ChatMessage]] = []
    adapter_id: Optional[str] = None
    # ✅ DOCUMENT CONTEXT FIELDS
    extractedText: Optional[str] = None
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileType: Optional[str] = None
    textLength: Optional[int] = 0
    documentType: Optional[str] = None
    contextEnabled: Optional[bool] = False
    contextInstruction: Optional[str] = None

class IntentRequest(BaseModel):
    message: str

class IntentResponse(BaseModel):
    intent: str

# ✅ Intent Recognition (simplified)
async def recognize_intent(message: str) -> str:
    message_lower = message.lower()
    if any(word in message_lower for word in ["train", "training", "model", "lora"]): 
        return "training"
    elif any(word in message_lower for word in ["health", "status", "check"]): 
        return "health"
    elif any(word in message_lower for word in ["hello", "hi", "hey"]): 
        return "greeting"
    else: 
        return "general"

# ✅ Health check endpoint
@app.get("/health")
async def health_check():
    """Simple health check"""
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "lora_services_available": HAS_LORA_SERVICES,
                "training_service": training_service is not None,
                "model_manager": model_manager is not None
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# ✅ FIXED: SINGLE ENHANCED CHAT ENDPOINT
@app.post("/chat")
async def enhanced_chat_endpoint(request: EnhancedChatRequest):
    try:
        logger.info(f"💬 Enhanced chat request - Type: {request.type}, Session: {request.sessionId}")
        
        # ✅ ENHANCED DOCUMENT PROCESSING
        if request.type == "document" and request.extractedText:
            logger.info(f"📄 [DOCUMENT] Processing document: {request.fileName} ({len(request.extractedText)} chars)")
            
            # ✅ FIXED: COMPLETE DOCUMENT ANALYSIS PROMPT
            document_prompt = f"""You are analyzing a document. Here is the content:

Document Name: {request.fileName}
Document Type: {request.documentType or 'PDF'}
Content Length: {len(request.extractedText)} characters

User Question: {request.message}

Document Content:
{request.extractedText}

Please analyze this document and answer the user's question based on the content above. Be specific and reference details from the document."""

            logger.info(f"📋 [DOCUMENT] Created enhanced prompt ({len(document_prompt)} chars)")
            final_prompt = document_prompt
            
        elif request.contextInstruction:
            # ✅ USE EXPLICIT CONTEXT INSTRUCTION
            logger.info(f"🎯 [CONTEXT] Using explicit context instruction")
            final_prompt = f"{request.contextInstruction}\n\nUser question: {request.message}"
            
        else:
            # ✅ REGULAR TEXT PROCESSING
            logger.info("💬 [TEXT] Processing regular text message")
            final_prompt = request.message

        # ✅ ADD CONVERSATION CONTEXT
        if request.conversation_context and len(request.conversation_context) > 0:
            logger.info(f"🔄 [CONTEXT] Adding {len(request.conversation_context)} conversation messages")
            context_messages = []
            for msg in request.conversation_context[-5:]:  # Last 5 messages for context
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    # Handle ChatMessage objects
                    context_messages.append(f"{msg.role}: {msg.content}")
                elif isinstance(msg, dict):
                    # Handle dict objects
                    role = msg.get('role', 'user')
                    content = msg.get('content', '')
                    context_messages.append(f"{role}: {content}")
            
            if context_messages:
                conversation_context = "\n".join(context_messages)
                final_prompt = f"Previous conversation:\n{conversation_context}\n\nCurrent request:\n{final_prompt}"

        logger.info(f"🔍 [CHAT] Final prompt length: {len(final_prompt)} characters")

        # ✅ Check for LoRA adapter first
        if request.adapter_id and model_manager:
            logger.info(f"🔍 Attempting to use LoRA adapter: {request.adapter_id}")
            lora_service = model_manager.get_model_inference_service(request.adapter_id)
            
            if lora_service:
                try:
                    logger.info("🚀 Using LoRA inference service")
                    response = await lora_service.generate_response(
                        final_prompt,
                        max_new_tokens=1000 if request.type == "document" else 500,
                        temperature=0.3 if request.type == "document" else 0.7,
                        top_p=0.9
                    )
                    
                    async def stream_lora_response():
                        for i, char in enumerate(response):
                            yield char
                            if i % 3 == 0:  # Faster streaming for better UX
                                await asyncio.sleep(0.005)
                    
                    logger.info(f"✅ LoRA response generated: {len(response)} characters")
                    return StreamingResponse(stream_lora_response(), media_type="text/plain")
                    
                except Exception as e:
                    logger.error(f"❌ LoRA inference failed: {e}. Falling back to base model.")

        # ✅ FALLBACK TO OLLAMA WITH ENHANCED PARAMETERS
        try:
            client = AsyncClient(host=LLAMA_URL)
            
            # ✅ ENHANCED MESSAGE STRUCTURE FOR BETTER DOCUMENT ANALYSIS
            system_prompt = "You are a helpful AI assistant."
            if request.type == "document":
                system_prompt += " When analyzing documents, be thorough and specific, referencing the actual content. Provide detailed insights about the document's content, structure, and key information."
            elif request.type == "image":
                system_prompt += " When analyzing images, describe what you see in detail, including objects, people, text, colors, and composition."
            
            messages = [
                {
                    "role": "system", 
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": final_prompt
                }
            ]
            
            logger.info(f"🦙 [OLLAMA] Sending to Ollama with {len(messages)} messages")
            
            # ✅ OPTIMIZED PARAMETERS FOR DIFFERENT CONTENT TYPES
            is_document_or_image = request.type in ["document", "image"] or request.extractedText
            
            options = {
                "temperature": 0.3 if request.type == "document" else 0.7,
                "top_p": 0.9,
                "repeat_penalty": 1.1
            }
            
            # Add num_predict for longer responses on documents
            if is_document_or_image:
                options["num_predict"] = 2000
            else:
                options["num_predict"] = 1000
            
            stream = await client.chat(
                model="llama3", 
                messages=messages, 
                stream=True,
                options=options
            )
            
            async def stream_ollama_response():
                try:
                    logger.info("🌊 [STREAMING] Starting Ollama response stream")
                    chunk_count = 0
                    total_content = ""
                    
                    async for chunk in stream:
                        if chunk and 'message' in chunk:
                            content = chunk['message'].get('content', '')
                            if content:
                                total_content += content
                                chunk_count += 1
                                yield content
                                
                                # ✅ LOG PROGRESS FOR DOCUMENT ANALYSIS
                                if chunk_count % 20 == 0 and is_document_or_image:
                                    logger.info(f"📊 [STREAM] Chunk {chunk_count}, Total: {len(total_content)} chars")
                    
                    logger.info(f"✅ [STREAMING] Completed - {chunk_count} chunks, {len(total_content)} characters")
                    
                except Exception as stream_error:
                    logger.error(f"❌ [STREAMING] Error: {stream_error}")
                    yield f"\n\n❌ Streaming error: {str(stream_error)}"
            
            return StreamingResponse(stream_ollama_response(), media_type="text/plain")
            
        except Exception as ollama_error:
            logger.error(f"❌ [OLLAMA] Error: {ollama_error}")
            
            async def error_response():
                error_msg = f"❌ AI service temporarily unavailable: {str(ollama_error)}"
                if request.type == "document" and request.fileName:
                    error_msg += f"\n\nI can see you uploaded '{request.fileName}' ({len(request.extractedText or '')} characters), but I'm unable to process it right now."
                elif request.type == "image" and request.fileName:
                    error_msg += f"\n\nI can see you uploaded the image '{request.fileName}', but I'm unable to analyze it right now."
                error_msg += "\n\nPlease try again in a moment."
                yield error_msg
            
            return StreamingResponse(error_response(), media_type="text/plain")
    
    except Exception as e:
        logger.error(f"❌ [ENHANCED CHAT] Error: {e}")
        
        async def error_response():
            yield f"❌ Chat processing failed: {str(e)}. Please try again."
        
        return StreamingResponse(error_response(), media_type="text/plain")

# ✅ Training Endpoint
@app.post("/train/lora/{job_id}")
async def train_lora_endpoint(
    job_id: str,
    dataset: UploadFile = File(...),
    base_model: str = Form("llama3"),
    parameters: str = Form("{}")
):
    try:
        logger.info(f"🚀 Starting LoRA training for job: {job_id}")
        logger.info(f"📋 Base model: {base_model}, Parameters: {parameters}")
        
        # Create datasets directory if it doesn't exist
        dataset_dir = Path("./datasets")
        dataset_dir.mkdir(exist_ok=True)
        
        # Save uploaded dataset
        dataset_path = dataset_dir / f"{job_id}.json"
        
        with open(dataset_path, "wb") as f:
            content = await dataset.read()
            f.write(content)
        
        logger.info(f"📁 Dataset saved to: {dataset_path} (Size: {len(content)} bytes)")
        
        # ✅ FIX: Ensure parameters are a dictionary before use
        try:
            parsed_parameters = json.loads(parameters) if parameters else {}
        except json.JSONDecodeError:
            logger.warning("⚠️ Invalid parameters JSON, using defaults")
            parsed_parameters = {}
        
        # ✅ The base_model is a separate form field, so add it to the dictionary
        parsed_parameters["base_model"] = base_model
        
        if training_service:
            await training_service.start_training(job_id, "lora", str(dataset_path), parsed_parameters)
            status_message = "LoRA training started successfully"
            logger.info(f"✅ Training service started for job: {job_id}")
        else:
            logger.warning("⚠️ Training service not available - mock start")
            status_message = "LoRA training request received (service not implemented)"
        
        return {
            "success": True, 
            "status": "started", 
            "job_id": job_id, 
            "message": status_message,
            "dataset_path": str(dataset_path),
            "base_model": base_model,
            "parameters": parsed_parameters
        }
    except Exception as e:
        logger.error(f"❌ Failed to start LoRA training: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start LoRA training: {str(e)}")

# ✅ Cancel training endpoint
@app.post("/train/cancel/{job_id}")
async def cancel_training_endpoint(job_id: str):
    try:
        logger.info(f"🛑 Cancelling training for job: {job_id}")
        
        if training_service:
            success = await training_service.cancel_training(job_id)
            if success:
                logger.info(f"✅ Training cancellation requested for: {job_id}")
                return {
                    "success": True, 
                    "message": f"Cancellation requested for {job_id}",
                    "job_id": job_id
                }
            else:
                logger.warning(f"⚠️ Training job not found: {job_id}")
                return {
                    "success": False,
                    "message": f"Training job {job_id} not found or already completed",
                    "job_id": job_id
                }
        else:
            logger.error("❌ Training service not available")
            raise HTTPException(status_code=503, detail="Training service not available")
    except Exception as e:
        logger.error(f"❌ Failed to cancel training: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel training: {str(e)}")

# ✅ Get all loaded models endpoint
@app.get("/models/loaded")
async def get_loaded_models_endpoint():
    try:
        logger.info("📊 Getting loaded models...")
        
        if model_manager:
            models = await model_manager.get_all_loaded_models()
            logger.info(f"✅ Found {len(models)} loaded models")
            return {
                "success": True, 
                "data": models,
                "models": models,  # For backend compatibility
                "count": len(models)
            }
        else:
            logger.error("❌ Model manager not available")
            raise HTTPException(status_code=503, detail="Model manager not available")
    except Exception as e:
        logger.error(f"❌ Failed to get loaded models: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": [],
            "models": []
        }

# ✅ Get all available adapters endpoint (unified)
@app.get("/models/available-adapters")
async def get_available_adapters_endpoint():
    try:
        logger.info("📊 Getting available LoRA adapters...")
        
        if model_manager:
            adapters = await model_manager.list_available_lora_adapters()
            logger.info(f"✅ Found {len(adapters)} available adapters")
            return {
                "success": True, 
                "data": adapters,
                "adapters": adapters,  # For backend compatibility
                "count": len(adapters)
            }
        else:
            logger.error("❌ Model manager not available")
            raise HTTPException(status_code=503, detail="Model manager not available")
    except Exception as e:
        logger.error(f"❌ Failed to get available adapters: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": [],
            "adapters": []
        }

# ✅ Alternative endpoint for backward compatibility
@app.get("/models/adapters/available")
async def get_available_adapters_alt():
    """Alternative endpoint for backward compatibility"""
    return await get_available_adapters_endpoint()

# ✅ Load LoRA adapter endpoint
@app.post("/models/load-lora")
async def load_lora_adapter_endpoint(request: Dict[str, Any]):
    try:
        adapter_path = request.get("adapter_path")
        base_model = request.get("base_model", "llama3")
        
        if not adapter_path:
            raise HTTPException(status_code=400, detail="adapter_path is required")
        
        logger.info(f"📥 Loading LoRA adapter: {adapter_path} on {base_model}")
        
        if model_manager:
            try:
                result = await model_manager.load_lora_adapter(adapter_path, base_model)
                logger.info(f"✅ LoRA adapter loaded successfully: {adapter_path}")
                return {
                    "success": True, 
                    "data": result,
                    "message": result.get("message", "LoRA adapter loaded successfully")
                }
            except Exception as e:
                logger.error(f"❌ Failed to load LoRA adapter: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        else:
            logger.error("❌ Model manager not available")
            raise HTTPException(status_code=503, detail="Model manager not available")
    except Exception as e:
        logger.error(f"❌ Load LoRA adapter error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load LoRA adapter: {str(e)}")

# ✅ Unload model endpoint (Fixed: Use DELETE method and path param)
@app.delete("/models/unload/{model_id}")
async def unload_model_endpoint(model_id: str):
    try:
        logger.info(f"🗑️ Unloading model: {model_id}")
        
        if model_manager:
            try:
                result = await model_manager.unload_model(model_id)
                if result.get("success"):
                    logger.info(f"✅ Model unloaded successfully: {model_id}")
                    return {
                        "success": True, 
                        "message": "Model unloaded successfully",
                        "model_id": model_id
                    }
                else:
                    logger.error(f"❌ Failed to unload model: {result.get('error')}")
                    raise HTTPException(status_code=404, detail=result.get("error", "Model not found"))
            except Exception as e:
                logger.error(f"❌ Error unloading model: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        else:
            logger.error("❌ Model manager not available")
            raise HTTPException(status_code=503, detail="Model manager not available")
    except Exception as e:
        logger.error(f"❌ Unload model error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unload model: {str(e)}")

# ✅ Alternative POST endpoint for backward compatibility
@app.post("/models/unload")
async def unload_model_post_endpoint(request: Dict[str, Any]):
    """Alternative POST endpoint for backward compatibility"""
    model_id = request.get("model_id")
    if not model_id:
        raise HTTPException(status_code=400, detail="model_id is required")
    return await unload_model_endpoint(model_id)

# ✅ Intent recognition endpoint
@app.post("/intent", response_model=IntentResponse)
async def intent_endpoint(request: IntentRequest):
    try:
        intent = await recognize_intent(request.message)
        logger.info(f"🎯 Intent recognized: {intent} for message: {request.message[:50]}...")
        return IntentResponse(intent=intent)
    except Exception as e:
        logger.error(f"❌ Intent recognition failed: {e}")
        return IntentResponse(intent="general")

# ✅ Get model status endpoint
@app.get("/models/{model_id}/status")
async def get_model_status(model_id: str):
    try:
        logger.info(f"🔍 Getting status for model: {model_id}")
        
        if model_manager:
            models = await model_manager.get_all_loaded_models()
            
            for model in models:
                if model.get("id") == model_id:
                    return {
                        "success": True,
                        "status": {
                            "status": model.get("status", "loaded"),
                            "type": model.get("type"),
                            "memory_usage": model.get("memory_usage"),
                            "loaded_at": model.get("loaded_at")
                        }
                    }
            
            return {
                "success": False,
                "message": f"Model {model_id} not found",
                "status": {"status": "not_found"}
            }
        else:
            return {
                "success": False,
                "message": "Model manager not available",
                "status": {"status": "service_unavailable"}
            }
        
    except Exception as e:
        logger.error(f"❌ Failed to get model status: {e}")
        return {
            "success": False,
            "error": str(e),
            "status": {"status": "error"}
        }

# ✅ ROOT ENDPOINT
@app.get("/")
def root():
    return {
        "message": "Nexus AI FastAPI Server",
        "status": "running",
        "version": "1.0.0",
        "services": {
            "lora_services": HAS_LORA_SERVICES,
            "training_service": training_service is not None,
            "model_manager": model_manager is not None
        },
        "endpoints": {
            "/health": "GET (Health check)",
            "/chat": "POST (Main chat endpoint with document/image support)",
            "/intent": "POST (Intent recognition)",
            "/models/loaded": "GET (List loaded models)",
            "/models/available-adapters": "GET (List trained adapters)",
            "/models/load-lora": "POST (Load LoRA adapter)",
            "/models/unload/{model_id}": "DELETE (Unload model)",
            "/train/lora/{job_id}": "POST (Start LoRA training)",
            "/train/cancel/{job_id}": "POST (Cancel training)"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
