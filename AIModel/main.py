from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ValidationError
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ollama import AsyncClient
import ollama
import json
from typing import Optional, Dict, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = "chat"
    fileUrl: Optional[str] = None
    fileType: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        valid_fields = {
            'prompt': data.get('prompt'),
            'message': data.get('message'), 
            'type': data.get('type', 'chat'),
            'fileUrl': data.get('fileUrl'),
            'fileType': data.get('fileType')
        }
        return cls(**{k: v for k, v in valid_fields.items() if v is not None})

@app.post("/chat")
async def unified_chat_route(request: Request):
    try:
        try:
            raw_body = await request.body()
            print(f"🔍 [FASTAPI] Raw body: {raw_body}")
            
            if raw_body:
                json_data = json.loads(raw_body)
                print(f"🔍 [FASTAPI] Parsed JSON: {json.dumps(json_data, indent=2)}")
            else:
                raise HTTPException(status_code=400, detail="Empty request body")
                
        except json.JSONDecodeError as e:
            print(f"❌ [FASTAPI] JSON decode error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
        
        try:
            chat_request = ChatRequest.from_dict(json_data)
            print(f"🔍 [FASTAPI] ChatRequest object: {chat_request.dict()}")
        except Exception as e:
            print(f"❌ [FASTAPI] ChatRequest creation error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid request format: {str(e)}")
        
        user_input = chat_request.prompt or chat_request.message
        
        if not user_input or not user_input.strip():
            print(f"❌ [FASTAPI] No valid input found. prompt: {chat_request.prompt}, message: {chat_request.message}")
            raise HTTPException(status_code=400, detail="No prompt or message provided")
            
        print(f"🚀 [FASTAPI] Processing request: {user_input[:50]}...")
        print(f"📋 [FASTAPI] Request type: {chat_request.type}")
        
        if chat_request.type.lower() == "chat":
            try:
                client = AsyncClient()
                
                async def response_generator():
                    try:
                        print(f"🤖 [FASTAPI] Calling Ollama with model: llama3")
                        print(f"🤖 [FASTAPI] User input: {user_input}")
                        
                        stream = await client.chat(
                            model='llama3',
                            messages=[{"role": "user", "content": user_input}],
                            stream=True
                        )
                        
                        chunk_count = 0
                        total_content = ""
                        
                        async for chunk in stream:
                            content = chunk.get('message', {}).get('content', '')
                            if content:
                                chunk_count += 1
                                total_content += content
                                print(f"📝 [STREAM] Chunk {chunk_count}: '{content}'")
                                yield content
                        
                        print(f"✅ [FASTAPI] Stream completed. Total chunks: {chunk_count}")
                        print(f"✅ [FASTAPI] Total content length: {len(total_content)}")
                                
                    except Exception as e:
                        error_msg = f"❌ Ollama Error: {str(e)}"
                        print(f"❌ [STREAM] Error: {error_msg}")
                        yield error_msg

                return StreamingResponse(
                    response_generator(), 
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
            raise HTTPException(status_code=400, detail=f"Unsupported type: {chat_request.type}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [FASTAPI] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ✅ FIXED HEALTH CHECK - BETTER MODEL DETECTION
@app.get("/health")
async def health_check():
    try:
        print("🔍 [HEALTH] Checking Ollama connection...")
        
        # ✅ FIRST TRY DIRECT OLLAMA API (matches your curl test)
        try:
            import httpx
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get("http://localhost:11434/api/tags")
                if response.status_code == 200:
                    ollama_data = response.json()
                    print(f"🔍 [HEALTH] Direct Ollama API response: {ollama_data}")
                    
                    if "models" in ollama_data:
                        available_models = []
                        for model in ollama_data["models"]:
                            model_name = model.get("name", "")
                            if model_name:
                                available_models.append(model_name)
                                print(f"🔍 [HEALTH] Found model: {model_name}")
                        
                        llama3_available = any("llama3" in model.lower() for model in available_models)
                        
                        print(f"🔍 [HEALTH] Available models: {available_models}")
                        print(f"🔍 [HEALTH] Llama3 available: {llama3_available}")
                        
                        return {
                            "status": "ok",
                            "message": "FastAPI is running",
                            "ollama_connected": True,
                            "llama3_available": llama3_available,
                            "available_models": available_models,
                            "detection_method": "direct_api"
                        }
                    
        except Exception as direct_api_error:
            print(f"❌ [HEALTH] Direct API failed: {direct_api_error}")
        
        # ✅ FALLBACK: TRY ASYNC CLIENT (original method)
        try:
            client = AsyncClient()
            models_response = await client.list()
            print(f"🔍 [HEALTH] AsyncClient response: {models_response}")
            
            # Handle different response formats
            models_list = []
            if isinstance(models_response, dict):
                if 'models' in models_response:
                    models_list = models_response['models']
                elif 'data' in models_response:
                    models_list = models_response['data']
                else:
                    models_list = list(models_response.values())[0] if models_response else []
            
            available_models = []
            for model in models_list:
                if isinstance(model, dict):
                    model_name = model.get('name', '') or model.get('model', '')
                    if model_name:
                        available_models.append(model_name)
                elif isinstance(model, str):
                    available_models.append(model)
            
            llama3_available = any("llama3" in model.lower() for model in available_models)
            
            return {
                "status": "ok",
                "message": "FastAPI is running", 
                "ollama_connected": True,
                "llama3_available": llama3_available,
                "available_models": available_models,
                "detection_method": "async_client"
            }
            
        except Exception as async_client_error:
            print(f"❌ [HEALTH] AsyncClient failed: {async_client_error}")
        
        # ✅ FINAL FALLBACK: TEST LLAMA3 DIRECTLY
        try:
            print("🔍 [HEALTH] Testing llama3 directly...")
            client = AsyncClient()
            test_response = await client.chat(
                model='llama3',
                messages=[{"role": "user", "content": "test"}],
                stream=False
            )
            
            if test_response and test_response.get('message'):
                print("✅ [HEALTH] llama3 direct test successful!")
                return {
                    "status": "ok",
                    "message": "FastAPI is running",
                    "ollama_connected": True,
                    "llama3_available": True,
                    "available_models": ["llama3:latest"],
                    "detection_method": "direct_chat_test"
                }
                
        except Exception as test_error:
            print(f"❌ [HEALTH] Direct test failed: {test_error}")
        
        # ✅ IF ALL FAILS, RETURN PARTIAL STATUS
        return {
            "status": "partial",
            "message": "FastAPI running, Ollama connected, but model detection failed",
            "ollama_connected": True,
            "llama3_available": False,
            "available_models": [],
            "note": "Chat endpoint may still work despite detection failure"
        }
        
    except Exception as e:
        print(f"❌ [HEALTH] Ollama connection error: {e}")
        return {
            "status": "partial",
            "message": "FastAPI is running but Ollama is not available",
            "ollama_connected": False,
            "llama3_available": False,
            "available_models": [],
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

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting FastAPI server...")
    print("📡 Endpoints available:")
    print("   - POST /chat (AI chat)")
    print("   - GET /health (Health check)")
    print("   - POST /debug (Debug requests)")
    print("   - POST /test (Simple test)")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
