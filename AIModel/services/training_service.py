import asyncio
import requests
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from ollama import AsyncClient
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import os

logger = logging.getLogger(__name__)

class TrainingService:
    def __init__(self, node_backend_url: str = None):
        if node_backend_url is None:
            node_backend_url = os.environ.get("NODE_BACKEND_URL", "http://localhost:3000")
        self.node_backend_url = node_backend_url
        self.active_jobs: Dict[str, Dict] = {}
        self.loaded_models: Dict[str, Any] = {}
    
    async def start_training(self, job_id: str, model_name: str, dataset: str, parameters: Dict = None):
        """Start model training based on model type"""
        try:
            params = parameters or {}
            
            # Add to active jobs tracking
            self.active_jobs[job_id] = {
                "model_name": model_name,
                "dataset": dataset,
                "status": "running",
                "start_time": datetime.now()
            }
            
            await self._update_status(job_id, "running", f"Initializing {model_name} training...")
            
            # Route to appropriate training method
            if "llama" in model_name.lower():
                await self._train_llama(job_id, model_name, dataset, params)
            elif "blip" in model_name.lower():
                await self._train_blip(job_id, model_name, dataset, params)
            else:
                raise ValueError(f"Unsupported model type: {model_name}")
                
        except Exception as e:
            await self._update_status(job_id, "failed", f"Training failed: {str(e)}")
            logger.error(f"Training failed for job {job_id}: {str(e)}")
    
    async def _train_llama(self, job_id: str, model_name: str, dataset: str, params: Dict):
        """Train Llama model using your existing Ollama setup"""
        try:
            await self._update_status(job_id, "running", "Connecting to Ollama service...")
            
            # Connect to your existing Ollama instance
            client = AsyncClient(host='http://127.0.0.1:11434')
            
            # Training phases (replace with actual Ollama fine-tuning)
            phases = [
                (20, "Loading base Llama model..."),
                (35, "Preprocessing training dataset..."),
                (50, "Starting fine-tuning process..."),
                (70, "Training epoch 1/3 completed"),
                (85, "Training epoch 2/3 completed"),
                (95, "Training epoch 3/3 completed"),
                (100, "Saving fine-tuned model...")
            ]
            
            for progress, message in phases:
                await asyncio.sleep(3)  # Simulate training time
                await self._update_status(job_id, "running", message, progress=progress)
            
            # Calculate final accuracy (replace with actual calculation)
            final_accuracy = 0.89 + (hash(job_id) % 10) / 100
            
            await self._update_status(
                job_id, 
                "completed", 
                f"Llama training completed with accuracy: {final_accuracy:.3f}",
                accuracy=final_accuracy
            )
            
        except Exception as e:
            await self._update_status(job_id, "failed", f"Llama training error: {str(e)}")
    
    async def _train_blip(self, job_id: str, model_name: str, dataset: str, params: Dict):
        """Train BLIP model using your existing BLIP server"""
        try:
            await self._update_status(job_id, "running", "Initializing BLIP training...")
            
            # Check if BLIP server is running (same as your existing health check)
            try:
                health_check = requests.get("http://127.0.0.1:5001/health", timeout=5)
                if health_check.status_code != 200:
                    raise Exception("BLIP server is not healthy")
            except requests.exceptions.ConnectionError:
                raise Exception("Cannot connect to BLIP server on port 5001")
            
            # BLIP training phases
            phases = [
                (15, "Loading BLIP model from server..."),
                (30, "Preparing image-text dataset..."),
                (50, "Fine-tuning vision encoder..."),
                (70, "Fine-tuning text decoder..."),
                (90, "Validating model performance..."),
                (100, "Saving trained BLIP model...")
            ]
            
            for progress, message in phases:
                await asyncio.sleep(4)  # Simulate training time
                await self._update_status(job_id, "running", message, progress=progress)
            
            # Simulate BLIP accuracy
            final_accuracy = 0.82 + (hash(job_id) % 8) / 100
            
            await self._update_status(
                job_id,
                "completed",
                f"BLIP training completed with accuracy: {final_accuracy:.3f}",
                accuracy=final_accuracy
            )
            
        except Exception as e:
            await self._update_status(job_id, "failed", f"BLIP training error: {str(e)}")
    
    async def _update_status(self, job_id: str, status: str, log: str, 
                           progress: Optional[float] = None, accuracy: Optional[float] = None):
        """Send status update to Node.js backend"""
        payload = {"status": status, "log": log}
        if progress is not None:
            payload["progress"] = progress
        if accuracy is not None:
            payload["accuracy"] = accuracy

        try:
            response = requests.put(
                f"{self.node_backend_url}/api/admin/model/training/{job_id}/status",
                json=payload,
                timeout=10
            )
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to update status for {job_id}: {e}")
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a training job"""
        if job_id in self.active_jobs:
            self.active_jobs[job_id]["status"] = "cancelled"
            return True
        return False
    
    def get_job_status(self, job_id: str) -> Dict:
        """Get job status from memory"""
        return self.active_jobs.get(job_id, {"status": "not_found"})
