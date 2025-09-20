import logging
import json
from pathlib import Path
from typing import Dict, Any, Optional
import asyncio  # ✅ FIX: Add asyncio for async loading

# Import with fallbacks for heavy ML dependencies
try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
    from peft import PeftModel, PeftConfig
    HAS_ML_DEPS = True
except ImportError as e:
    print(f"⚠️ ML dependencies not available: {e}")
    HAS_ML_DEPS = False

logger = logging.getLogger(__name__)

class LoRAInferenceService:
    def __init__(self, base_model_name: str, lora_path: str, device: str = None, load_in_8bit: bool = True):
        self.base_model_name = base_model_name
        self.lora_path = lora_path
        self.load_in_8bit = load_in_8bit  # ✅ FIX: Add load_in_8bit parameter
        
        if HAS_ML_DEPS:
            self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = "cpu"
            
        logger.info(f"✅ LoRAInferenceService initialized for {base_model_name} with adapter {Path(lora_path).name}")
        logger.info(f"🔧 Device: {self.device}, 8-bit loading: {self.load_in_8bit}")
        
        # For now, we'll defer actual model loading to avoid heavy initialization
        self.model = None
        self.tokenizer = None
        self.generator = None
        self._loaded = False
        self._load_lock = asyncio.Lock()  # ✅ FIX: Add async lock for thread safety

    async def _ensure_loaded(self):
        """Load model and tokenizer if not already loaded"""
        if self._loaded or not HAS_ML_DEPS:
            return
            
        # ✅ FIX: Use an async lock to prevent race conditions during loading
        async with self._load_lock:
            # Double-check after acquiring the lock
            if self._loaded:
                return

            try:
                logger.info(f"🔄 Loading base model and LoRA adapter...")
                
                # Load tokenizer
                logger.info(f"📚 Loading tokenizer for {self.base_model_name}")
                self.tokenizer = AutoTokenizer.from_pretrained(
                    self.base_model_name,
                    trust_remote_code=True
                )
                if self.tokenizer.pad_token is None:
                    self.tokenizer.pad_token = self.tokenizer.eos_token
                    self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
                
                logger.info(f"🤖 Loading base model {self.base_model_name}")
                
                # ✅ FIX: Enhanced model loading configuration
                model_kwargs = {
                    "torch_dtype": torch.float16 if self.device == "cuda" else torch.float32,
                    "trust_remote_code": True,
                    "low_cpu_mem_usage": True,
                }
                
                # Add device mapping and 8-bit loading for CUDA
                if self.device == "cuda":
                    model_kwargs["device_map"] = "auto"
                    if self.load_in_8bit:
                        model_kwargs["load_in_8bit"] = True
                        logger.info("🔧 Using 8-bit quantization")
                else:
                    logger.info("🔧 CPU mode: disabling 8-bit quantization")
                    model_kwargs["load_in_8bit"] = False
                
                # Load base model
                base_model = AutoModelForCausalLM.from_pretrained(
                    self.base_model_name,
                    **model_kwargs
                )

                logger.info(f"🔗 Loading LoRA adapter from {self.lora_path}")
                
                # ✅ FIX: Enhanced LoRA loading with error handling
                if not Path(self.lora_path).exists():
                    raise FileNotFoundError(f"LoRA adapter path does not exist: {self.lora_path}")
                
                # Load LoRA adapter
                self.model = PeftModel.from_pretrained(
                    base_model, 
                    self.lora_path,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    device_map="auto" if self.device == "cuda" else None
                )
                self.model.eval()

                logger.info("🚀 Creating text generation pipeline")
                
                # ✅ FIX: Enhanced pipeline configuration
                pipeline_kwargs = {
                    "task": "text-generation",
                    "model": self.model,
                    "tokenizer": self.tokenizer,
                    "torch_dtype": torch.float16 if self.device == "cuda" else torch.float32,
                    "return_full_text": False,  # Only return generated text
                    "clean_up_tokenization_spaces": True
                }
                
                # Set device for pipeline
                if self.device == "cuda":
                    pipeline_kwargs["device"] = 0
                else:
                    pipeline_kwargs["device"] = -1
                
                # Create pipeline for text generation
                self.generator = pipeline(**pipeline_kwargs)
                
                self._loaded = True
                logger.info("✅ LoRA model and pipeline loaded successfully")
                
                # Log memory usage if CUDA
                if self.device == "cuda" and torch.cuda.is_available():
                    memory_allocated = torch.cuda.memory_allocated() / 1024**3
                    memory_cached = torch.cuda.memory_reserved() / 1024**3
                    logger.info(f"🎯 GPU Memory - Allocated: {memory_allocated:.2f}GB, Cached: {memory_cached:.2f}GB")
                
            except Exception as e:
                logger.error(f"❌ Failed to load LoRA model: {e}")
                # Fallback to simple response
                self._loaded = False
                raise e

    async def generate_response(self, prompt: str, max_new_tokens: int = 200, temperature: float = 0.7, top_p: float = 0.9) -> str:
        """Generate response using LoRA adapter"""
        try:
            if not HAS_ML_DEPS:
                return f"🤖 LoRA Mock Response: This is a mock response from adapter {Path(self.lora_path).name} for: {prompt[:100]}..."
            
            # ✅ FIX: Await the loading process
            if not self._loaded:
                logger.info("⏳ Model not loaded, loading now...")
                await self._ensure_loaded()
            
            if not self._loaded:
                return f"❌ Failed to load LoRA model. Mock response for: {prompt[:50]}..."
            
            if self.generator:
                logger.debug(f"🔄 Generating response for prompt: {prompt[:50]}...")
                
                # ✅ FIX: Enhanced generation parameters
                generation_kwargs = {
                    "max_new_tokens": max_new_tokens,
                    "temperature": temperature,
                    "top_p": top_p,
                    "do_sample": True,
                    "pad_token_id": self.tokenizer.eos_token_id,
                    "eos_token_id": self.tokenizer.eos_token_id,
                    "repetition_penalty": 1.1,
                    "length_penalty": 1.0,
                }
                
                # Add stop sequences to prevent overly long generations
                if hasattr(self.tokenizer, 'encode'):
                    # Common stop sequences
                    stop_sequences = ["</s>", "[INST]", "[/INST]", "###"]
                    generation_kwargs["stop_sequence"] = stop_sequences
                
                response = self.generator(
                    prompt,
                    **generation_kwargs
                )
                
                # ✅ FIX: Enhanced text extraction and cleaning
                if isinstance(response, list) and len(response) > 0:
                    generated_text = response[0].get("generated_text", "")
                    
                    # Clean up the generated text
                    if generated_text.startswith(prompt):
                        generated_text = generated_text[len(prompt):].strip()
                    
                    # Remove common artifacts
                    artifacts_to_remove = ["</s>", "<pad>", "<unk>"]
                    for artifact in artifacts_to_remove:
                        generated_text = generated_text.replace(artifact, "")
                    
                    # Clean up extra whitespace
                    generated_text = " ".join(generated_text.split())
                    
                    logger.debug(f"✅ Generated response: {generated_text[:100]}...")
                    return generated_text.strip()
                else:
                    logger.warning("⚠️ Empty response from generator")
                    return "⚠️ Generated empty response"
            else:
                logger.warning("⚠️ Generator not available")
                return f"⚠️ LoRA model not fully loaded. Mock response for: {prompt[:50]}..."
                
        except Exception as e:
            logger.error(f"❌ Generation failed: {e}")
            return f"❌ LoRA generation error: {str(e)}"

    async def unload_model(self):
        """Unload the model to free memory"""
        try:
            logger.info("🗑️ Unloading LoRA model...")
            
            async with self._load_lock:
                if self.generator:
                    del self.generator
                    self.generator = None
                
                if self.model:
                    del self.model
                    self.model = None
                
                if self.tokenizer:
                    del self.tokenizer
                    self.tokenizer = None
                
                self._loaded = False
            
            # Clear GPU cache if available
            if HAS_ML_DEPS and torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("🧹 GPU cache cleared")
            
            logger.info("✅ LoRA model unloaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to unload model: {e}")
            raise e

    def is_loaded(self) -> bool:
        """Check if the model is currently loaded"""
        return self._loaded

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        return {
            "base_model": self.base_model_name,
            "lora_path": str(self.lora_path),
            "device": self.device,
            "load_in_8bit": self.load_in_8bit,
            "is_loaded": self._loaded,
            "has_ml_deps": HAS_ML_DEPS
        }

    async def warmup(self, sample_prompt: str = "Hello, how are you?"):
        """Warm up the model with a sample generation"""
        try:
            if not self._loaded:
                await self._ensure_loaded()
            
            logger.info("🔥 Warming up model...")
            warmup_response = await self.generate_response(
                sample_prompt, 
                max_new_tokens=10, 
                temperature=0.7
            )
            logger.info(f"✅ Warmup completed. Sample: {warmup_response[:50]}...")
            return True
        except Exception as e:
            logger.error(f"❌ Warmup failed: {e}")
            return False
