import os
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
import asyncio

# ✅ FIX: Import with fallbacks for ML dependencies
try:
    from services.inference_service import LoRAInferenceService
    from config.training_config import TrainingConfig
    HAS_ML_DEPS = True
except ImportError as e:
    print(f"⚠️ ML dependencies not available: {e}")
    HAS_ML_DEPS = False
    class TrainingConfig:
        LORA_TRAINED_PATH = Path("models/lora_adapters/trained")
        @classmethod
        def ensure_model_directories(cls):
            cls.LORA_TRAINED_PATH.mkdir(parents=True, exist_ok=True)
    LoRAInferenceService = None

logger = logging.getLogger(__name__)

class ModelManager:
    def __init__(self):
        self.loaded_models: Dict[str, Dict[str, Any]] = {}
        TrainingConfig.ensure_model_directories()
        logger.info("✅ ModelManager initialized")

    async def get_all_loaded_models(self) -> List[Dict[str, Any]]:
        """Return all currently loaded models with consistent structure"""
        models = []
        
        # ✅ FIX: Ensure a consistent data structure
        base_models = [
            {
                "id": "llama3",
                "modelId": "llama3",
                "name": "Llama 3 Base",
                "type": "base",
                "status": "available",
                "memory_usage": "N/A",
                "loaded_at": datetime.now().isoformat(),
                "can_unload": False,
                "description": "Base Llama 3 model (from Ollama)"
            }
        ]
        models.extend(base_models)
        
        for model_id, model_info in self.loaded_models.items():
            model_data = {
                "id": model_id,
                "modelId": model_id,
                "name": model_info.get("name", model_id),
                "type": model_info.get("type", "lora"),
                "status": "loaded",
                "adapter_path": model_info.get("adapter_path"),
                "base_model": model_info.get("base_model"),
                "memory_usage": model_info.get("memory_usage", "Unknown"),
                "loaded_at": model_info.get("loaded_at", datetime.now().isoformat()),
                "size": model_info.get("size", "Unknown"),
                "can_unload": True,
                "description": f"LoRA adapter on {model_info.get('base_model', 'unknown')} base"
            }
            models.append(model_data)
        
        logger.info(f"📊 Returning {len(models)} models ({len(self.loaded_models)} LoRA + {len(base_models)} base)")
        return models

    async def list_available_lora_adapters(self) -> List[Dict[str, Any]]:
        """List all available LoRA adapters on disk"""
        adapters = []
        lora_dir = TrainingConfig.LORA_TRAINED_PATH
        
        if not lora_dir.exists():
            return adapters
        
        for adapter_dir in lora_dir.iterdir():
            if adapter_dir.is_dir():
                config_file = adapter_dir / "adapter_config.json"
                if config_file.exists():
                    adapter_info = {
                        "name": adapter_dir.name,
                        "path": str(adapter_dir),
                        "size": self._get_directory_size(adapter_dir),
                        "created": datetime.fromtimestamp(adapter_dir.stat().st_mtime).isoformat(),
                        "is_loaded": any(
                            model_info.get("adapter_path") == str(adapter_dir)
                            for model_info in self.loaded_models.values()
                        )
                    }
                    try:
                        training_config_file = adapter_dir / "training_config.json"
                        if training_config_file.exists():
                            with open(training_config_file, 'r') as f:
                                training_config = json.load(f)
                                adapter_info["base_model"] = training_config.get("base_model_name", "llama3")
                                adapter_info["train_loss"] = training_config.get("train_loss")
                    except Exception as e:
                        logger.warning(f"Failed to read training_config for {adapter_dir}: {e}")
                    
                    adapters.append(adapter_info)
        
        adapters.sort(key=lambda x: x["created"], reverse=True)
        return adapters

    async def load_lora_adapter(self, adapter_path: str, base_model: str = "llama3") -> Dict[str, Any]:
        """Load a LoRA adapter for inference"""
        try:
            if not HAS_ML_DEPS:
                raise ImportError("ML dependencies not installed. Cannot load LoRA adapter.")
            
            adapter_path_obj = Path(adapter_path)
            if not adapter_path_obj.exists():
                raise FileNotFoundError(f"LoRA adapter not found: {adapter_path}")
            
            adapter_name = adapter_path_obj.name
            model_id = f"lora_{adapter_name}"
            
            if model_id in self.loaded_models:
                return {"success": True, "message": f"Adapter {adapter_name} is already loaded"}

            logger.info(f"🔄 Loading LoRA adapter: {adapter_name} on base model {base_model}")
            
            try:
                # ✅ FIX: Use the base_model parameter to load the correct base model
                lora_service = LoRAInferenceService(
                    base_model_name=self._get_base_model_path(base_model),
                    lora_path=adapter_path
                )
                
                self.loaded_models[model_id] = {
                    "id": model_id,
                    "name": adapter_name,
                    "type": "lora",
                    "base_model": base_model,
                    "adapter_path": adapter_path,
                    "size": self._get_directory_size(adapter_path_obj),
                    "loaded_at": datetime.now().isoformat(),
                    "service": lora_service,
                    "memory_usage": "~2GB"
                }
                
                logger.info(f"✅ LoRA adapter loaded successfully: {model_id}")
                
                return {"success": True, "message": "LoRA adapter loaded successfully", "model_id": model_id}
            except Exception as e:
                logger.error(f"❌ Failed to initialize LoRA service: {e}")
                self.loaded_models.pop(model_id, None)
                raise e
                
        except Exception as e:
            logger.error(f"❌ Failed to load LoRA adapter {adapter_path}: {e}")
            raise e

    async def unload_model(self, model_id: str) -> Dict[str, Any]:
        """Unload a model"""
        try:
            if model_id not in self.loaded_models:
                return {"success": False, "error": "Model not found", "message": f"Model {model_id} not found in loaded models"}
            
            model_info = self.loaded_models.pop(model_id)
            if "service" in model_info and model_info["service"] is not None:
                del model_info["service"]
            
            logger.info(f"✅ Model unloaded successfully: {model_id}")
            return {"success": True, "message": f"Model {model_id} unloaded successfully"}
        
        except Exception as e:
            logger.error(f"❌ Failed to unload model {model_id}: {e}")
            return {"success": False, "error": "Unload failed", "message": str(e)}

    def _get_directory_size(self, directory: Path) -> str:
        """Calculate directory size in human readable format"""
        try:
            total_size = sum(f.stat().st_size for f in directory.rglob('*') if f.is_file())
            
            if total_size < 1024 * 1024:
                return f"{total_size / 1024:.1f} KB"
            elif total_size < 1024 * 1024 * 1024:
                return f"{total_size / (1024 * 1024):.1f} MB"
            else:
                return f"{total_size / (1024 * 1024 * 1024):.1f} GB"
        except Exception:
            return "Unknown"

    def _get_base_model_path(self, base_model: str) -> str:
        """Map base model name to actual model path"""
        model_mapping = {
            "llama3": "meta-llama/Llama-2-7b-hf",  # Use available model
            "llama2": "meta-llama/Llama-2-7b-hf",
            "codellama": "codellama/CodeLlama-7b-hf",
            "mistral": "mistralai/Mistral-7B-v0.1"
        }
        return model_mapping.get(base_model, model_mapping["llama2"])

    def get_training_statistics(self) -> Dict[str, Any]:
        """Get training statistics"""
        stats = {
            "total_adapters": len(self.list_available_lora_adapters()),
            "loaded_adapters": len([m for m in self.loaded_models.values() if m["type"] == "lora"]),
            "total_disk_usage": "0 MB"
        }
        
        # Calculate total disk usage
        total_size = 0
        lora_dir = TrainingConfig.LORA_TRAINED_PATH
        if lora_dir.exists():
            for adapter_dir in lora_dir.iterdir():
                if adapter_dir.is_dir():
                    total_size += sum(f.stat().st_size for f in adapter_dir.rglob('*') if f.is_file())
        
        stats["total_disk_usage"] = f"{total_size / (1024 * 1024):.1f} MB"
        
        return stats
