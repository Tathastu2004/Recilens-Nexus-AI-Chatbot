from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class TrainingStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class TrainingRequest(BaseModel):
    jobId: str
    modelName: str
    dataset: str
    parameters: Optional[Dict[str, Any]] = {}

class TrainingUpdate(BaseModel):
    jobId: str
    status: TrainingStatus
    log: Optional[str] = None
    accuracy: Optional[float] = None
    progress: Optional[float] = None

class CancelRequest(BaseModel):
    jobId: str

class ModelLoadRequest(BaseModel):
    modelId: str
    modelPath: str
    modelType: str = "llama"
    parameters: Dict[str, Any] = {}

class ModelUnloadRequest(BaseModel):
    modelId: str

class ModelStatusResponse(BaseModel):
    modelId: str
    status: str
    type: Optional[str] = None
    loadTime: Optional[datetime] = None
    error: Optional[str] = None
