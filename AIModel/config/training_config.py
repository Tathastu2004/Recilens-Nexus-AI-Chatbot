import os
from pathlib import Path

class TrainingConfig:
    # Base directories
    BASE_DIR = Path(__file__).parent.parent
    MODELS_DIR = BASE_DIR / "models"
    DATASETS_DIR = BASE_DIR / "datasets"
    
    # LoRA specific paths
    LORA_ADAPTERS_PATH = MODELS_DIR / "lora_adapters"
    LORA_TRAINED_PATH = LORA_ADAPTERS_PATH / "trained"
    LORA_CHECKPOINTS_PATH = LORA_ADAPTERS_PATH / "checkpoints"
    
    # Node.js backend URL
    NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:3000")
    
    # Ollama configuration
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    LLAMA_URL = os.getenv("LLAMA_URL", "http://127.0.0.1:11434")
    
    # Default LoRA parameters
    DEFAULT_LORA_CONFIG = {
        "r": 16,
        "lora_alpha": 32,
        "lora_dropout": 0.1,
        "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
        "bias": "none"
    }
    
    # Default training parameters
    DEFAULT_TRAINING_CONFIG = {
        "learning_rate": 2e-4,
        "num_train_epochs": 3,
        "per_device_train_batch_size": 4,
        "gradient_accumulation_steps": 4,
        "warmup_steps": 100,
        "logging_steps": 10,
        "save_steps": 500,
        "max_grad_norm": 0.3,
        "weight_decay": 0.001
    }
    
    @classmethod
    def ensure_model_directories(cls):
        """Ensure all necessary directories exist"""
        directories = [
            cls.MODELS_DIR,
            cls.DATASETS_DIR,
            cls.LORA_ADAPTERS_PATH,
            cls.LORA_TRAINED_PATH,
            cls.LORA_CHECKPOINTS_PATH
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"📁 Created directory: {directory}")
