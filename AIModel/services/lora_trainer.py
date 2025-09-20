import os
import json
import torch
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from datasets import Dataset, load_dataset
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer, 
    TrainingArguments, 
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, TaskType
import bitsandbytes as bnb

logger = logging.getLogger(__name__)

class LoRATrainer:
    def __init__(self, 
                 base_model_name: str,
                 dataset_path: str,
                 output_dir: str,
                 **kwargs):
        
        self.base_model_name = base_model_name
        self.dataset_path = dataset_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # ✅ FIX: LoRA configuration from kwargs for flexibility
        self.lora_config = {
            "r": kwargs.get("r", 16),
            "lora_alpha": kwargs.get("lora_alpha", 32),
            "lora_dropout": kwargs.get("lora_dropout", 0.1),
            "target_modules": kwargs.get("target_modules", ["q_proj", "v_proj", "k_proj", "o_proj"]),
            "bias": kwargs.get("bias", "none"),
            "task_type": TaskType.CAUSAL_LM
        }
        
        # ✅ FIX: Training configuration from kwargs for flexibility
        self.training_config = {
            "learning_rate": kwargs.get("learning_rate", 2e-4),
            "num_train_epochs": kwargs.get("epochs", 3),
            "per_device_train_batch_size": kwargs.get("batch_size", 4),
            "gradient_accumulation_steps": kwargs.get("gradient_accumulation_steps", 4),
            "warmup_steps": kwargs.get("warmup_steps", 100),
            "max_steps": kwargs.get("max_steps", -1),
            "logging_steps": kwargs.get("logging_steps", 10),
            "save_steps": kwargs.get("save_steps", 500),
            "eval_steps": kwargs.get("eval_steps", 500),
            "max_grad_norm": 0.3,
            "weight_decay": 0.001,
            "optim": "paged_adamw_32bit",
            "lr_scheduler_type": "cosine",
            "fp16": True,
            "gradient_checkpointing": True,
            "dataloader_pin_memory": False,
            "remove_unused_columns": False,
            "evaluation_strategy": "no",
            "save_strategy": "steps",
            "save_total_limit": 3,
            "report_to": "none",
        }
        
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        logger.info(f"✅ LoRATrainer initialized for {base_model_name}")
        logger.info(f"📁 Output directory: {self.output_dir}")
        logger.info(f"🔧 Device: {self.device}")

    def load_model_and_tokenizer(self):
        """Load the base model and tokenizer"""
        try:
            logger.info(f"🔄 Loading tokenizer for {self.base_model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.base_model_name, trust_remote_code=True)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
                self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
            
            logger.info(f"🔄 Loading model {self.base_model_name}")
            self.model = AutoModelForCausalLM.from_pretrained(
                self.base_model_name,
                load_in_8bit=True,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True
            )
            self.model = prepare_model_for_kbit_training(self.model)
            self.model.gradient_checkpointing_enable()
            
            logger.info("✅ Model and tokenizer loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load model and tokenizer: {e}")
            raise e

    def prepare_lora_model(self):
        """Apply LoRA configuration to the model"""
        try:
            logger.info("🔄 Preparing LoRA model...")
            lora_config = LoraConfig(**self.lora_config)
            self.model = get_peft_model(self.model, lora_config)
            self.model.print_trainable_parameters()
            logger.info("✅ LoRA model prepared successfully")
        except Exception as e:
            logger.error(f"❌ Failed to prepare LoRA model: {e}")
            raise e

    def load_and_preprocess_dataset(self) -> Dataset:
        """Load and preprocess the training dataset"""
        try:
            logger.info(f"🔄 Loading dataset from {self.dataset_path}")
            dataset_path = Path(self.dataset_path)
            
            # ✅ FIX: Load dataset from file
            if dataset_path.suffix.lower() in ['.json', '.jsonl']:
                dataset = load_dataset('json', data_files=str(dataset_path), split='train')
            elif dataset_path.suffix.lower() == '.csv':
                dataset = load_dataset('csv', data_files=str(dataset_path), split='train')
            else:
                raise ValueError(f"Unsupported dataset format: {dataset_path.suffix}")
            
            logger.info(f"📊 Dataset loaded with {len(dataset)} examples")
            
            # Preprocess dataset to a uniform text format
            dataset = self._preprocess_dataset(dataset)
            
            return dataset
        except Exception as e:
            logger.error(f"❌ Failed to load dataset: {e}")
            raise e

    def _preprocess_dataset(self, dataset: Dataset) -> Dataset:
        """Preprocess the dataset for training"""
        try:
            logger.info("🔄 Preprocessing dataset...")
            
            def format_instruction(example):
                if 'instruction' in example and 'output' in example:
                    # Alpaca format
                    input_text = example.get('input', '')
                    if input_text:
                        text = f"### Instruction:\n{example['instruction']}\n\n### Input:\n{input_text}\n\n### Response:\n{example['output']}"
                    else:
                        text = f"### Instruction:\n{example['instruction']}\n\n### Response:\n{example['output']}"
                elif 'text' in example:
                    # Generic text format
                    text = example['text']
                elif 'prompt' in example and 'response' in example:
                    # Prompt-response format
                    text = f"### Prompt:\n{example['prompt']}\n\n### Response:\n{example['response']}"
                else:
                    # Try to use first available text field
                    text_fields = ['content', 'message', 'conversation']
                    text = None
                    for field in text_fields:
                        if field in example:
                            text = example[field]
                            break
                    
                    if text is None:
                        raise ValueError(f"Could not find a valid text field in dataset example: {example.keys()}")
                
                return {"text": text}
            
            dataset = dataset.map(format_instruction, remove_columns=dataset.column_names)
            
            def tokenize_function(examples):
                tokenized = self.tokenizer(
                    examples["text"],
                    truncation=True,
                    padding=False,
                    max_length=2048,
                    return_tensors=None
                )
                tokenized["labels"] = tokenized["input_ids"].copy()
                return tokenized
            
            dataset = dataset.map(
                tokenize_function,
                batched=True,
                remove_columns=dataset.column_names
            )
            
            logger.info("✅ Dataset preprocessed successfully")
            return dataset
        except Exception as e:
            logger.error(f"❌ Failed to preprocess dataset: {e}")
            raise e

    def train(self) -> Dict[str, Any]:
        """Execute the training process"""
        try:
            logger.info("🚀 Starting LoRA training...")
            self.load_model_and_tokenizer()
            self.prepare_lora_model()
            train_dataset = self.load_and_preprocess_dataset()
            
            data_collator = DataCollatorForLanguageModeling(
                tokenizer=self.tokenizer,
                mlm=False,
                pad_to_multiple_of=8
            )
            
            training_args = TrainingArguments(
                output_dir=str(self.output_dir),
                overwrite_output_dir=True,
                **self.training_config,
                remove_unused_columns=False,
                dataloader_num_workers=4,
                group_by_length=True,
                logging_dir=str(self.output_dir / "logs"),
                warmup_ratio=0.1,
            )
            
            trainer = Trainer(
                model=self.model,
                args=training_args,
                train_dataset=train_dataset,
                data_collator=data_collator,
                tokenizer=self.tokenizer,
            )
            
            logger.info("🏃‍♂️ Beginning training...")
            train_result = trainer.train()
            
            logger.info("💾 Saving trained model...")
            trainer.save_model()
            self.tokenizer.save_pretrained(self.output_dir)
            
            config_path = self.output_dir / "training_config.json"
            with open(config_path, 'w') as f:
                json.dump({
                    "base_model_name": self.base_model_name,
                    "lora_config": self.lora_config,
                    "training_config": self.training_config,
                    "train_runtime": train_result.metrics.get("train_runtime"),
                    "train_samples_per_second": train_result.metrics.get("train_samples_per_second"),
                    "train_loss": train_result.metrics.get("train_loss"),
                    "trained_at": datetime.now().isoformat()
                }, f, indent=2)
            
            logger.info(f"✅ Training completed! Model saved to {self.output_dir}")
            
            return {
                "success": True,
                "output_dir": str(self.output_dir),
                "train_loss": train_result.metrics.get("train_loss"),
                "train_runtime": train_result.metrics.get("train_runtime"),
                "train_samples_per_second": train_result.metrics.get("train_samples_per_second")
            }
            
        except Exception as e:
            logger.error(f"❌ Training failed: {e}")
            return {"success": False, "error": str(e)}
        finally:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    def get_training_progress(self) -> Dict[str, Any]:
        """Get current training progress (placeholder for future implementation)"""
        return {
            "status": "training",
            "current_step": 0,
            "total_steps": 0,
            "current_loss": 0.0
        }
