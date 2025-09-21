import os
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
import asyncio

from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain.prompts import PromptTemplate
from langchain.chains import RetrievalQA

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
    """
    Manages the Ollama model and the Retrieval-Augmented Generation (RAG) pipeline.
    This class orchestrates document retrieval and context-aware response generation.
    """
    def __init__(self, ollama_model="llama3"):
        self.ollama_model_name = ollama_model
        
        # 1. Initialize the embedding model for creating vectors from text
        self.embeddings = OllamaEmbeddings(model=self.ollama_model_name)
        logger.info(f"✅ OllamaEmbeddings model initialized: {self.ollama_model_name}")

        # 2. Initialize the vector store (ChromaDB) to retrieve relevant document chunks
        self.vectorstore = Chroma(
            collection_name="company_data",
            embedding_function=self.embeddings,
            persist_directory="./chroma_db"
        )
        logger.info("✅ ChromaDB vector store initialized")

        # 3. Initialize the Ollama LLM for generating responses
        self.llm = OllamaLLM(model=self.ollama_model_name)
        logger.info(f"✅ Ollama LLM initialized: {self.ollama_model_name}")

        # 4. Create the RetrievalQA chain
        self.qa_chain = self._initialize_qa_chain()

    def _initialize_qa_chain(self):
        """
        Creates and returns the RetrievalQA chain. This chain handles the end-to-end
        RAG process: retrieval and generation.
        """
        prompt_template = """
        Based on the following context, analyze the user's question and provide a comprehensive answer.
        If the context does not contain enough information, state that you don't know rather than making up an answer.

        Context:
        {context}

        Question: {question}

        Helpful Answer:
        """
        QA_PROMPT = PromptTemplate(
            template=prompt_template, input_variables=["context", "question"]
        )

        # The chain combines the retriever and the LLM
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.vectorstore.as_retriever(search_kwargs={"k": 5}), # Retrieve top 5 documents
            chain_type_kwargs={"prompt": QA_PROMPT},
            return_source_documents=True
        )
        logger.info("✅ RetrievalQA chain initialized")
        return qa_chain

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

    def get_embedding_model(self) -> OllamaEmbeddings:
        """
        Returns the embedding model instance. Used by the IngestionService
        to ensure consistency between embedding documents and queries.
        """
        return self.embeddings

    def should_use_rag(self, query: str) -> bool:
        """Determine if a query should use RAG based on content"""
        # ✅ ENHANCED RAG DETECTION - Much more comprehensive
        rag_indicators = [
            # Document-related keywords
            "document", "pdf", "file", "data sheet", "company data", "uploaded", "ingested",
            
            # Question patterns that benefit from RAG
            "what", "how", "why", "when", "where", "who", "which", "explain", "describe",
            "tell me about", "information about", "details about", "show me", "find",
            "search", "look for", "according to", "based on", "from the", "in the",
            
            # Analysis keywords
            "analyze", "summarize", "compare", "review", "evaluate", "assess", "examine",
            
            # Specific content queries
            "price", "cost", "specification", "feature", "procedure", "process", "step",
            "requirement", "guideline", "policy", "rule", "instruction", "method",
            
            # Business/technical terms that are likely in documents
            "technical", "specification", "manual", "guide", "report", "analysis",
            "data", "statistics", "number", "figure", "table", "chart", "graph"
        ]
        
        query_lower = query.lower()
        
        # ✅ Check for any RAG indicators
        has_indicators = any(indicator in query_lower for indicator in rag_indicators)
        
        # ✅ Additional checks for question patterns
        question_patterns = ["what is", "what are", "how to", "how do", "tell me", "show me"]
        has_question_pattern = any(pattern in query_lower for pattern in question_patterns)
        
        # ✅ If it's a greeting or very short, don't use RAG
        greeting_patterns = ["hi", "hello", "hey", "good morning", "good afternoon", "thanks", "thank you"]
        is_greeting = any(greeting in query_lower for greeting in greeting_patterns) and len(query.split()) < 5
        
        if is_greeting:
            return False
        
        # ✅ Use RAG if query has indicators OR is a question pattern with some length
        should_rag = has_indicators or (has_question_pattern and len(query.split()) > 3)
        
        logger.info(f"🤖 [RAG DETECTION] Query: '{query[:50]}...' -> Use RAG: {should_rag}")
        logger.info(f"    Indicators: {has_indicators}, Questions: {has_question_pattern}, Greeting: {is_greeting}")
        
        return should_rag

    def get_rag_response(self, prompt: str, conversation_context: List[Any]) -> str:
        """Enhanced RAG response with better error handling and document verification"""
        try:
            logger.info(f"🔍 [RAG] Processing query: {prompt[:100]}...")
            
            # ✅ STEP 1: Check if we have any documents in the vector store
            try:
                # Get collection info to check document count
                collection = self.vectorstore._collection
                collection_count = collection.count()
                
                logger.info(f"📊 [RAG] Vector store has {collection_count} documents")
                
                if collection_count == 0:
                    logger.warning("⚠️ [RAG] No documents found in vector store")
                    return """I don't have any documents in my knowledge base yet. 

To use RAG features:
1. Go to Admin → Model Management 
2. Upload documents in the "Data Sheets" tab
3. Wait for successful ingestion
4. Then ask questions about your documents

For now, I'll provide a general response to your question."""
                
            except Exception as e:
                logger.error(f"❌ [RAG] Vector store access failed: {e}")
                return "I'm having trouble accessing the document database. Please try again later."
            
            # ✅ STEP 2: Perform retrieval to get relevant documents
            try:
                logger.info(f"🔍 [RAG] Searching for relevant documents...")
                retriever = self.vectorstore.as_retriever(search_kwargs={"k": 5})
                relevant_docs = retriever.get_relevant_documents(prompt)
                
                logger.info(f"📄 [RAG] Found {len(relevant_docs)} potentially relevant documents")
                
                if not relevant_docs:
                    logger.warning("⚠️ [RAG] No relevant documents found for this query")
                    return f"""I searched through your uploaded documents but couldn't find information specifically related to your question: "{prompt}"

This might be because:
- The information isn't in your uploaded documents
- The question needs to be more specific
- The documents need better indexing

I can provide a general answer, or you can try rephrasing your question to be more specific."""
                
                # Log what documents were found (for debugging)
                for i, doc in enumerate(relevant_docs):
                    doc_id = doc.metadata.get('doc_id', 'unknown')
                    content_preview = doc.page_content[:100].replace('\n', ' ')
                    logger.info(f"  📄 Doc {i+1}: ID={doc_id}, Content='{content_preview}...'")
                
            except Exception as e:
                logger.error(f"❌ [RAG] Document retrieval failed: {e}")
                return f"I encountered an error while searching through your documents: {str(e)}"
            
            # ✅ STEP 3: Generate response using the QA chain
            try:
                logger.info(f"🤖 [RAG] Generating response using {len(relevant_docs)} documents...")
                
                result = self.qa_chain.invoke({"query": prompt})
                answer = result["result"]
                
                # ✅ STEP 4: Enhance the response with metadata
                source_docs = result.get("source_documents", relevant_docs)
                
                if source_docs:
                    # Get unique document IDs
                    doc_ids = list(set(doc.metadata.get('doc_id', 'unknown') for doc in source_docs))
                    doc_ids = [doc_id for doc_id in doc_ids if doc_id != 'unknown']
                    
                    logger.info(f"✅ [RAG] Response generated using documents: {doc_ids}")
                    
                    # Add source information
                    if doc_ids:
                        answer += f"\n\n📚 *Based on information from your uploaded documents (IDs: {', '.join(doc_ids)}).*"
                    else:
                        answer += f"\n\n📚 *Based on {len(source_docs)} document sections from your knowledge base.*"
                else:
                    logger.warning("⚠️ [RAG] No source documents in result")
                    answer += "\n\n*Note: I provided this answer using general knowledge as I couldn't find specific information in your documents.*"
                
                return answer
                
            except Exception as e:
                logger.error(f"❌ [RAG] Response generation failed: {e}")
                return f"I found relevant documents but encountered an error while generating the response: {str(e)}. Please try rephrasing your question."
                
        except Exception as e:
            logger.error(f"❌ [RAG] Overall RAG process failed: {e}")
            return f"I'm sorry, I encountered an unexpected error while processing your question: {str(e)}. Please try again."
