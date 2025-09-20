import os
from pathlib import Path

class TrainingConfig:
    # Node.js backend URL
    NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:3000")
    
    # Ollama configuration
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    
    # BLIP server configuration
    BLIP_HOST = os.getenv("BLIP_HOST", "http://127.0.0.1:5001")
    
    # Model storage paths
    MODELS_BASE_PATH = Path(os.getenv("MODELS_PATH", "./models"))
    LLAMA_MODELS_PATH = MODELS_BASE_PATH / "llama"
    BLIP_MODELS_PATH = MODELS_BASE_PATH / "blip"
    
    # Training parameters
    DEFAULT_TRAINING_PARAMS = {
        "llama": {
            "max_epochs": 3,
            "learning_rate": 1e-5,
            "batch_size": 4,
            "max_seq_length": 2048
        },
        "blip": {
            "max_epochs": 5,
            "learning_rate": 2e-5,
            "batch_size": 8,
            "image_size": 384
        }
    }
    
    # Logging configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def ensure_model_directories(cls):
        """Create model directories if they don't exist"""
        cls.LLAMA_MODELS_PATH.mkdir(parents=True, exist_ok=True)
        cls.BLIP_MODELS_PATH.mkdir(parents=True, exist_ok=True)
