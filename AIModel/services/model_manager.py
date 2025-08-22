import logging
from datetime import datetime
from typing import Dict, Any, Optional
from ollama import AsyncClient
import requests

logger = logging.getLogger(__name__)

class ModelManager:
    def __init__(self):
        self.loaded_models: Dict[str, Dict] = {}
        self.ollama_client = AsyncClient(host='http://127.0.0.1:11434')
    
    async def load_model(self, model_id: str, model_path: str, model_type: str, parameters: Dict = None):
        """Load a model (Llama or BLIP)"""
        try:
            if model_type.lower() == "llama":
                return await self._load_llama_model(model_id, model_path, parameters)
            elif model_type.lower() == "blip":
                return await self._load_blip_model(model_id, model_path, parameters)
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {str(e)}")
            raise
    
    async def _load_llama_model(self, model_id: str, model_path: str, parameters: Dict = None):
        """Load Llama model via Ollama"""
        try:
            # Check if Ollama is running
            health_check = requests.get("http://127.0.0.1:11434/health", timeout=5)
            if health_check.status_code != 200:
                raise Exception("Ollama service is not running")
            
            # For Ollama, models are typically pre-loaded, so we just verify
            models_response = requests.get("http://127.0.0.1:11434/api/tags")
            if models_response.status_code == 200:
                available_models = models_response.json().get('models', [])
                model_names = [model.get('name', '') for model in available_models]
                
                if not any(model_id in name for name in model_names):
                    raise Exception(f"Model {model_id} not found in Ollama")
            
            self.loaded_models[model_id] = {
                "type": "llama",
                "status": "loaded",
                "load_time": datetime.now(),
                "model_path": model_path,
                "parameters": parameters or {}
            }
            
            return {
                "status": "success",
                "message": f"Llama model {model_id} loaded successfully",
                "model_id": model_id
            }
            
        except Exception as e:
            raise Exception(f"Failed to load Llama model: {str(e)}")
    
    async def _load_blip_model(self, model_id: str, model_path: str, parameters: Dict = None):
        """Load BLIP model via your existing BLIP server"""
        try:
            # Check if BLIP server is running
            health_check = requests.get("http://127.0.0.1:5001/health", timeout=5)
            if health_check.status_code != 200:
                raise Exception("BLIP server is not running")
            
            # Your BLIP server should handle model loading
            self.loaded_models[model_id] = {
                "type": "blip",
                "status": "loaded",
                "load_time": datetime.now(),
                "model_path": model_path,
                "parameters": parameters or {}
            }
            
            return {
                "status": "success", 
                "message": f"BLIP model {model_id} loaded successfully",
                "model_id": model_id
            }
            
        except Exception as e:
            raise Exception(f"Failed to load BLIP model: {str(e)}")
    
    async def unload_model(self, model_id: str):
        """Unload a model"""
        if model_id in self.loaded_models:
            del self.loaded_models[model_id]
            return {
                "status": "success",
                "message": f"Model {model_id} unloaded",
                "model_id": model_id
            }
        else:
            raise Exception(f"Model {model_id} not found")
    
    def get_model_status(self, model_id: str):
        """Get status of a specific model"""
        if model_id in self.loaded_models:
            return self.loaded_models[model_id]
        else:
            return {"status": "not_loaded", "model_id": model_id}
    
    def get_all_loaded_models(self):
        """Get all loaded models"""
        return list(self.loaded_models.values())
