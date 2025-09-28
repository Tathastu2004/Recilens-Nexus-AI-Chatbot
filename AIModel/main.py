# main.py - RAG FOCUS
import asyncio
import os
import logging
import uuid
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
import httpx
import tempfile

# ✅ FIXED: Add proper error handling for optional RAG services
try:
    from services.model_manager import ModelManager
    from services.training_service import IngestionService
    HAS_RAG_SERVICES = True
    print("✅ RAG services imported successfully")
except ImportError as e:
    print(f"⚠️ Warning: Could not import RAG services: {e}")
    print("📝 RAG features will be disabled, but chat will still work")
    HAS_RAG_SERVICES = False
    ModelManager = None
    IngestionService = None

load_dotenv()

LLAMA_URL = os.getenv("LLAMA_URL", "http://127.0.0.1:11434")
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:3000")

# ✅ FIXED: Initialize RAG services with proper error handling
model_manager = None
ingestion_service = None

if HAS_RAG_SERVICES:
    try:
        print("🔄 Initializing RAG services...")
        model_manager = ModelManager()
        print("✅ ModelManager created")
        
        ingestion_service = IngestionService(model_manager.get_embedding_model())
        print("✅ IngestionService created")
        
        print("✅ RAG services initialized successfully")
    except Exception as e:
        print(f"❌ RAG initialization failed: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback:")
        traceback.print_exc()
        print("📝 RAG features will be disabled, but chat will still work")
        model_manager = None
        ingestion_service = None  # ← This is why it's None!

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nexus AI FastAPI Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ PYDANTIC MODELS
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
    extractedText: Optional[str] = None
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileType: Optional[str] = None
    textLength: Optional[int] = 0
    documentType: Optional[str] = None
    contextEnabled: Optional[bool] = False
    contextInstruction: Optional[str] = None
    # ✅ ADD THESE IMAGE CONTEXT FIELDS:
    hasActiveContext: Optional[bool] = False
    contextType: Optional[str] = None
    imageAnalysis: Optional[str] = None
    contextFileUrl: Optional[str] = None
    contextFileName: Optional[str] = None
    isFollowUpMessage: Optional[bool] = False
    hasImageContext: Optional[bool] = False
    imageUrl: Optional[str] = None

class IntentRequest(BaseModel):
    message: str

class IntentResponse(BaseModel):
    intent: str

async def recognize_intent(message: str) -> str:
    message_lower = message.lower()
    if any(word in message_lower for word in ["document", "pdf", "analyze", "file"]): 
        return "document_analysis"
    elif any(word in message_lower for word in ["train", "training", "model", "lora"]): 
        return "training"
    elif any(word in message_lower for word in ["health", "status", "check"]): 
        return "health"
    elif any(word in message_lower for word in ["hello", "hi", "hey"]): 
        return "greeting"
    else: 
        return "general"

@app.get("/health")
async def health_check():
    """Health check with proper RAG service status"""
    try:
        # ✅ Check Ollama connection
        ollama_status = "unknown"
        try:
            client = AsyncClient(host=LLAMA_URL)
            response = await client.list()
            ollama_status = "online" if response else "offline"
        except Exception as e:
            logger.warning(f"Ollama check failed: {e}")
            ollama_status = "offline"

        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "rag_services_available": HAS_RAG_SERVICES,
                "model_manager": model_manager is not None,
                "ingestion_service": ingestion_service is not None,
                "ollama": ollama_status
            },
            "endpoints": {
                "chat": "Available (with or without RAG)",
                "rag_ingestion": "Available" if ingestion_service else "Disabled",
                "document_deletion": "Available" if ingestion_service else "Disabled"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.get("/rag/health")
async def rag_health_check():
    """Specific RAG health check for adminController"""
    try:
        return {
            "status": "online" if model_manager else "offline",
            "rag_services": HAS_RAG_SERVICES,
            "model_manager": model_manager is not None,
            "ingestion_service": ingestion_service is not None,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"RAG health check failed: {e}")
        return {
            "status": "offline",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/vector/health")
async def vector_health_check():
    """Vector database health check for adminController"""
    try:
        # Since we don't have a separate vector DB, check if RAG services are available
        return {
            "status": "online" if model_manager else "offline",
            "vector_db": "embedded" if model_manager else "unavailable",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "offline",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ✅ FIXED: ROBUST CHAT ENDPOINT
@app.post("/chat")
async def enhanced_chat_endpoint(request: EnhancedChatRequest):
    try:
        logger.info(f"💬 Chat request - Type: {request.type}, Session: {request.sessionId}")
        
        # ✅ ENHANCED IMAGE CONTEXT DETECTION
        has_image_context = False
        image_url = None
        image_name = None
        
        # Debug all request fields
        logger.info(f"🔍 [DEBUG] Request fields:")
        logger.info(f"  - type: {request.type}")
        logger.info(f"  - fileUrl: {request.fileUrl}")
        logger.info(f"  - contextFileUrl: {request.contextFileUrl}")
        logger.info(f"  - hasImageContext: {request.hasImageContext}")
        logger.info(f"  - hasActiveContext: {request.hasActiveContext}")
        logger.info(f"  - contextType: {request.contextType}")
        logger.info(f"  - imageUrl: {request.imageUrl}")
        
        # Check for direct image upload
        if request.type == "image" and request.fileUrl:
            has_image_context = True
            image_url = request.fileUrl
            image_name = request.fileName or "Uploaded Image"
            logger.info(f"🖼️ [IMAGE] Direct image upload detected: {image_name}")
            logger.info(f"🖼️ [IMAGE] Image URL: {image_url}")
            
        # ✅ CHECK FOR IMAGE CONTEXT FROM FRONTEND
        elif request.contextFileUrl and request.contextType == "image":
            has_image_context = True
            image_url = request.contextFileUrl
            image_name = request.contextFileName or "Context Image"
            logger.info(f"🖼️ [IMAGE CONTEXT] Context image detected: {image_name}")
            logger.info(f"🖼️ [IMAGE CONTEXT] Context URL: {image_url}")
            
        # ✅ CHECK hasImageContext FLAG
        elif request.hasImageContext and request.imageUrl:
            has_image_context = True
            image_url = request.imageUrl
            image_name = request.contextFileName or request.fileName or "Previous Image"
            logger.info(f"🖼️ [IMAGE CONTEXT] hasImageContext flag detected: {image_name}")
            
        # ✅ FALLBACK: Check if ANY image URL exists
        elif request.fileUrl and (request.type == "image" or 
             (request.fileName and any(ext in request.fileName.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']))):
            has_image_context = True
            image_url = request.fileUrl
            image_name = request.fileName or "Image File"
            logger.info(f"🖼️ [IMAGE FALLBACK] Fallback image detection: {image_name}")
        
        # ✅ FINAL CHECK: Look for any Cloudinary image URL
        urls_to_check = [request.fileUrl, request.contextFileUrl, request.imageUrl]
        for url in urls_to_check:
            if url and 'cloudinary.com' in url and any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']):
                has_image_context = True
                image_url = url
                image_name = request.fileName or request.contextFileName or "Cloudinary Image"
                logger.info(f"🖼️ [IMAGE CLOUDINARY] Cloudinary image detected: {image_name}")
                break
        
        # ✅ HANDLE IMAGE CONTEXT WITH LLAMA VISION (FIXED)
        if has_image_context and image_url:
            logger.info(f"✅ [VISION] Processing image with Llama Vision")
            logger.info(f"  - Image URL: {image_url}")
            logger.info(f"  - Image Name: {image_name}")
            logger.info(f"  - Message: {request.message}")
            
            try:
                # ✅ STEP 1: Download image to temporary file
                logger.info("📥 [VISION] Downloading image to local file...")
                
                async with httpx.AsyncClient(timeout=30.0) as http_client:
                    image_response = await http_client.get(image_url)
                    
                    if image_response.status_code != 200:
                        logger.error(f"❌ [VISION] Failed to download image: HTTP {image_response.status_code}")
                        return StreamingResponse(
                            iter([f"❌ Could not download image from URL. HTTP status: {image_response.status_code}"]),
                            media_type="text/plain"
                        )
                    
                    # Create temporary file with appropriate extension
                    file_extension = image_url.split('.')[-1].split('?')[0] or 'jpg'
                    if file_extension not in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']:
                        file_extension = 'jpg'
                    
                    # Save to temporary file
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
                        temp_file.write(image_response.content)
                        temp_image_path = temp_file.name
                    
                    logger.info(f"✅ [VISION] Image downloaded to: {temp_image_path}")
                    logger.info(f"📊 [VISION] Image size: {len(image_response.content)} bytes")
                
                # ✅ STEP 2: Prepare messages for vision model
                vision_messages = []
                
                # Add conversation context if available
                if request.conversation_context and len(request.conversation_context) > 0:
                    for msg in request.conversation_context[-2:]:  # Last 2 messages for context
                        if hasattr(msg, 'role') and hasattr(msg, 'content'):
                            vision_messages.append({"role": msg.role, "content": msg.content})
                
                # Add the current user message with local image path
                vision_messages.append({
                    "role": "user", 
                    "content": f"Please analyze this image and answer my question: {request.message}",
                    "images": [temp_image_path]  # ✅ Use local file path instead of URL
                })
                
                logger.info(f"🦙 [VISION] Sending to vision model with {len(vision_messages)} messages")
                
                # ✅ STEP 3: Try different vision models
                vision_models = ["llava:13b", "llava:7b", "llama3.2-vision", "bakllava"]
                selected_model = None
                
                client = AsyncClient(host=LLAMA_URL)
                
                # Find available vision model
                try:
                    available_models = await client.list()
                    model_names = [model.model for model in available_models.models] if hasattr(available_models, 'models') else []
                    
                    for model in vision_models:
                        if any(model in available_model for available_model in model_names):
                            selected_model = model
                            logger.info(f"🎯 [VISION] Using model: {selected_model}")
                            break
                    
                    if not selected_model:
                        # Try partial matches
                        for model_info in model_names:
                            if any(keyword in model_info.lower() for keyword in ['llava', 'vision', 'bakllava']):
                                selected_model = model_info
                                logger.info(f"🎯 [VISION] Using detected vision model: {selected_model}")
                                break
                    
                    if not selected_model:
                        logger.error("❌ [VISION] No vision model available")
                        # Clean up temp file
                        try:
                            os.unlink(temp_image_path)
                        except:
                            pass
                        return StreamingResponse(
                            iter([f"❌ No vision-capable model is available. Please install one using:\n\nollama pull llava:7b\n\nThen restart this service."]),
                            media_type="text/plain"
                        )
                
                except Exception as model_check_error:
                    logger.error(f"❌ [VISION] Error checking models: {model_check_error}")
                    # Clean up temp file
                    try:
                        os.unlink(temp_image_path)
                    except:
                        pass
                    return StreamingResponse(
                        iter([f"❌ Error checking available models: {str(model_check_error)}"]),
                        media_type="text/plain"
                    )
                
                # ✅ STEP 4: Call Ollama with vision capability
                try:
                    vision_response = await client.chat(
                        model=selected_model,
                        messages=vision_messages,
                        stream=True,
                        options={
                            "temperature": 0.7,
                            "top_p": 0.9,
                            "num_predict": 1000
                        }
                    )
                    
                    # Stream the response back
                    async def stream_vision_response():
                        try:
                            logger.info("🌊 [VISION] Starting vision model response stream")
                            chunk_count = 0
                            total_content = ""
                            
                            async for chunk in vision_response:
                                if chunk and 'message' in chunk:
                                    content = chunk['message'].get('content', '')
                                    if content:
                                        total_content += content
                                        chunk_count += 1
                                        yield content
                            
                            logger.info(f"✅ [VISION] Completed - {chunk_count} chunks, {len(total_content)} characters")
                            
                        except Exception as stream_error:
                            logger.error(f"❌ [VISION] Stream error: {stream_error}")
                            yield f"\n\n❌ Vision processing error: {str(stream_error)}"
                        finally:
                            # ✅ Clean up temporary file
                            try:
                                os.unlink(temp_image_path)
                                logger.info("🗑️ [VISION] Cleaned up temporary image file")
                            except Exception as cleanup_error:
                                logger.warning(f"⚠️ [VISION] Could not clean up temp file: {cleanup_error}")
                    
                    return StreamingResponse(stream_vision_response(), media_type="text/plain")
                    
                except Exception as ollama_error:
                    logger.error(f"❌ [VISION] Ollama call failed: {ollama_error}")
                    # Clean up temp file
                    try:
                        os.unlink(temp_image_path)
                    except:
                        pass
                    return StreamingResponse(
                        iter([f"❌ Vision model call failed: {str(ollama_error)}\n\nPlease ensure you have a vision model installed:\nollama pull llava:7b"]),
                        media_type="text/plain"
                    )
            
            except Exception as vision_error:
                logger.error(f"❌ [VISION] General error: {vision_error}")
                return StreamingResponse(
                    iter([f"❌ Vision processing failed: {str(vision_error)}"]),
                    media_type="text/plain"
                )

        else:
            # ✅ NO IMAGE CONTEXT - continue with existing logic
            logger.info("💬 [TEXT] No image context detected, processing as text")
            
            if any(word in request.message.lower() for word in ['image', 'picture', 'photo', 'see', 'show', 'visual', 'provided']):
                final_prompt = f"""The user is asking about an image, but no image has been provided in this conversation.

User's question: {request.message}

I don't see any image that has been shared with me. Could you please upload an image if you'd like me to analyze one? I can help with image analysis once you share an image file."""
            else:
                final_prompt = request.message

        logger.info(f"🔍 [IMAGE DEBUG] Context detection result:")
        logger.info(f"  - has_image_context: {has_image_context}")
        logger.info(f"  - image_url: {image_url}")
        logger.info(f"  - image_name: {image_name}")
        logger.info(f"  - request.type: {request.type}")
        logger.info(f"  - request.hasImageContext: {request.hasImageContext}")
        logger.info(f"  - request.contextFileUrl: {request.contextFileUrl}")

        # ✅ SMART RAG DECISION: Only use RAG for document-related queries
        should_use_rag = False
        if request.contextEnabled and model_manager:
            # Check if the query is document-related
            query_lower = request.message.lower()
            document_keywords = [
                'document', 'pdf', 'file', 'uploaded', 'nexus ai', 'assistant', 
                'product overview', 'limitations', 'pricing', 'support contact',
                'maximum file size', 'context window', 'enterprise', 'features'
            ]
            
            # Use RAG only if query contains document-specific terms
            should_use_rag = any(keyword in query_lower for keyword in document_keywords)
            
            if should_use_rag:
                logger.info("📄 [RAG] Document-related query detected - using RAG")
            else:
                logger.info("🧠 [GENERAL] General knowledge query - using model's knowledge")
        
        # ✅ DOCUMENT PROCESSING WITH OR WITHOUT RAG
        if request.type == "document" and request.extractedText:
            logger.info(f"📄 [DOCUMENT] Processing document: {request.fileName} ({len(request.extractedText)} chars)")
            
            document_prompt = f"""You are analyzing a document. Here is the content:

Document Name: {request.fileName}
Document Type: {request.documentType or 'PDF'}
Content Length: {len(request.extractedText)} characters

User Question: {request.message}

Document Content:
{request.extractedText}

Please analyze this document and answer the user's question based on the content above. Be specific and reference details from the document."""

            final_prompt = document_prompt
            
        elif should_use_rag and model_manager:
            # ✅ RAG PIPELINE (only for document-related queries)
            logger.info("📄 [RAG] Using RAG for document-specific query")
            try:
                response = model_manager.get_rag_response(request.message, request.conversation_context)
                
                async def stream_rag_response():
                    for i, char in enumerate(response):
                        yield char
                        if i % 3 == 0:
                            await asyncio.sleep(0.01)
                
                return StreamingResponse(stream_rag_response(), media_type="text/plain")
            except Exception as rag_error:
                logger.error(f"❌ RAG processing failed: {rag_error}")
                final_prompt = request.message  # Fall back to general knowledge
        
        elif request.contextEnabled and not should_use_rag:
            # ✅ GENERAL KNOWLEDGE QUERY (don't use RAG)
            logger.info("🧠 [GENERAL] Using general knowledge for non-document query")
            final_prompt = request.message
            
        elif request.contextEnabled and not model_manager:
            # ✅ RAG requested but not available
            logger.info("🧠 [FALLBACK] RAG not available, using general knowledge")
            final_prompt = request.message
            
        elif request.contextInstruction:
            # ✅ USE EXPLICIT CONTEXT INSTRUCTION
            logger.info("🎯 [CONTEXT] Using explicit context instruction")
            final_prompt = f"{request.contextInstruction}\n\nUser question: {request.message}"
            
        else:
            # ✅ REGULAR TEXT PROCESSING
            logger.info("💬 [TEXT] Processing regular text message")
            final_prompt = request.message

        # ✅ ADD CONVERSATION CONTEXT
        messages = []
        
        # System message based on query type
        if request.type == "document":
            system_msg = "You are a helpful AI assistant specialized in document analysis. When analyzing documents, be thorough and specific, referencing the actual content."
        elif should_use_rag:
            system_msg = "You are a helpful AI assistant with access to company knowledge base. Use the provided context to give accurate and specific answers about the company's products and services."
        else:
            system_msg = "You are a helpful AI assistant. Use your general knowledge to provide clear, accurate, and helpful responses to any questions."
        
        messages.append({"role": "system", "content": system_msg})

        # Add conversation context if available
        if request.conversation_context and len(request.conversation_context) > 0:
            logger.info(f"🔄 [CONTEXT] Adding {len(request.conversation_context)} conversation messages")
            for msg in request.conversation_context[-5:]:
                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                    messages.append({"role": msg.role, "content": msg.content})
                elif isinstance(msg, dict):
                    role = msg.get('role', 'user')
                    content = msg.get('content', '')
                    messages.append({"role": role, "content": content})
        
        # Add current message
        messages.append({"role": "user", "content": final_prompt})

        logger.info(f"🦙 [OLLAMA] Sending to Ollama with {len(messages)} messages")

        # ✅ OLLAMA CHAT WITH ENHANCED PARAMETERS
        try:
            client = AsyncClient(host=LLAMA_URL)
            
            # Optimized parameters for different content types
            is_document = request.type == "document" or request.extractedText
            
            options = {
                "temperature": 0.3 if (is_document or should_use_rag) else 0.7,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "num_predict": 2000 if is_document else 1000
            }
            
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
                                
                                if chunk_count % 20 == 0 and is_document:
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
                error_msg += "\n\nPlease ensure Ollama is running on port 11434 and try again."
                yield error_msg
            
            return StreamingResponse(error_response(), media_type="text/plain")

    except Exception as chat_error:
        logger.error(f"❌ [CHAT] Processing failed: {chat_error}")
        
        async def error_response():
            yield f"❌ Chat processing failed: {str(chat_error)}. Please try again."
        
        return StreamingResponse(error_response(), media_type="text/plain")

# ✅ RAG-SPECIFIC ENDPOINTS (only if services available)
@app.post("/ingest_data")
async def ingest_data(
    file: UploadFile = File(...),
    doc_id: str = Form(...)
):
    """Ingests a new data sheet (PDF or image) into the RAG system."""
    logger.info(f"📄 [INGEST] Ingestion request received - File: {file.filename}, Doc ID: {doc_id}")
    
    if not ingestion_service:
        logger.warning("⚠️ Ingestion requested but RAG service not available")
        # ✅ DON'T raise HTTPException, return success with warning
        return {
            "success": True,  # ✅ Changed to True so backend doesn't think it failed
            "message": f"Document '{file.filename}' received but RAG indexing is not available. Document stored in database only.",
            "status": "stored_no_rag",
            "doc_id": doc_id,
            "filename": file.filename,
            "rag_available": False,
            "rag_indexed": False
        }
    
    file_path = f"data/{doc_id}_{file.filename}"
    os.makedirs("data", exist_ok=True)
    
    try:
        # Save file temporarily
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        logger.info(f"📄 [INGEST] Processing {file.filename} ({len(content)} bytes)")
        
        # Process with ingestion service
        await ingestion_service.ingest_document(file_path, doc_id)
        
        logger.info(f"✅ [INGEST] Successfully ingested {file.filename} with ID: {doc_id}")
        return {
            "success": True, 
            "message": f"Successfully ingested and indexed {file.filename} with ID: {doc_id}",
            "status": "fully_processed",
            "doc_id": doc_id,
            "filename": file.filename,
            "rag_available": True,
            "rag_indexed": True
        }
        
    except Exception as e:
        logger.error(f"❌ [INGEST] Ingestion failed: {e}")
        # ✅ Return partial success instead of complete failure
        return {
            "success": True,  # ✅ Document was at least uploaded
            "message": f"Document '{file.filename}' uploaded but RAG processing failed: {str(e)}",
            "status": "upload_success_processing_failed",
            "doc_id": doc_id,
            "filename": file.filename,
            "rag_available": True,
            "rag_indexed": False,
            "error": str(e)
        }
    finally:
        # Clean up temporary file
        if os.path.exists(file_path):
            os.remove(file_path)

@app.delete("/delete_data")
async def delete_data(doc_id: str = Form(...)):
    """Deletes a specific data sheet from the RAG system by its document ID."""
    logger.info(f"🗑️ [DELETE] Delete request received - Doc ID: {doc_id}")
    
    if not ingestion_service:
        logger.warning("⚠️ Deletion requested but RAG service not available")
        # ✅ DON'T raise HTTPException, return success with warning
        return {
            "success": True,  # ✅ Changed to True so backend doesn't think it failed
            "message": f"Document with ID '{doc_id}' deletion processed. RAG service not available but document can be removed from database.",
            "status": "rag_service_unavailable",
            "doc_id": doc_id,
            "deleted_from_rag": False,
            "rag_available": False
        }
    
    try:
        logger.info(f"🗑️ [DELETE] Deleting document ID: {doc_id}")
        
        success = ingestion_service.delete_document_by_id(doc_id)
        if success:
            logger.info(f"✅ [DELETE] Successfully deleted document with ID: {doc_id}")
            return {
                "success": True,
                "message": f"Successfully deleted document with ID: {doc_id}",
                "status": "deleted_from_rag",
                "doc_id": doc_id,
                "deleted_from_rag": True,
                "rag_available": True
            }
        else:
            logger.warning(f"⚠️ [DELETE] Document not found in RAG: {doc_id}")
            return {
                "success": True,  # ✅ Still success since it's not in RAG anyway
                "message": f"Document with ID '{doc_id}' not found in RAG index, but database cleanup can proceed.",
                "status": "not_found_in_rag",
                "doc_id": doc_id,
                "deleted_from_rag": False,
                "rag_available": True
            }
            
    except Exception as e:
        logger.error(f"❌ [DELETE] Deletion failed: {e}")
        # ✅ Return partial success instead of complete failure
        return {
            "success": True,  # ✅ Database deletion can still proceed
            "message": f"RAG deletion failed for '{doc_id}' but database cleanup can proceed: {str(e)}",
            "status": "rag_deletion_failed",
            "doc_id": doc_id,
            "deleted_from_rag": False,
            "rag_available": True,
            "error": str(e)
        }

@app.post("/intent", response_model=IntentResponse)
async def intent_endpoint(request: IntentRequest):
    try:
        intent = await recognize_intent(request.message)
        logger.info(f"🎯 Intent recognized: {intent} for message: {request.message[:50]}...")
        return IntentResponse(intent=intent)
    except Exception as e:
        logger.error(f"❌ Intent recognition failed: {e}")
        return IntentResponse(intent="general")

@app.get("/")
def root():
    return {
        "message": "Nexus AI FastAPI Server - RAG Enabled",
        "status": "running",
        "version": "1.0.0",
        "services": {
            "rag_services": HAS_RAG_SERVICES,
            "model_manager": model_manager is not None,
            "ingestion_service": ingestion_service is not None,
            "ollama_chat": "Always available (if Ollama running)"
        },
        "features": {
            "basic_chat": "✅ Available",
            "document_analysis": "✅ Available (enhanced with RAG if enabled)",
            "rag_ingestion": "✅ Available" if ingestion_service else "❌ Service not available",
            "rag_retrieval": "✅ Available" if model_manager else "❌ Service not available"
        },
        "endpoints": {
            "/health": "GET (Health check)",
            "/rag/health": "GET (RAG-specific health)",
            "/vector/health": "GET (Vector DB health)",
            "/chat": "POST (Main chat endpoint with document support and optional RAG)",
            "/ingest_data": "POST (Ingest a data sheet)" + (" - Available" if ingestion_service else " - Service not available"),
            "/delete_data": "DELETE (Delete a data sheet)" + (" - Available" if ingestion_service else " - Service not available"),
            "/intent": "POST (Intent recognition)"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
