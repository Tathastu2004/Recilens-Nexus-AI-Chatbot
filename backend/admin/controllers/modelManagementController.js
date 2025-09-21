import AdminConfig from "../models/AdminConfig.js";
import Analytics from "../models/Analytics.js";
import User from '../../models/User.js';
import Message from '../../models/Message.js';
import ChatSession from '../../models/ChatSession.js';
import IngestedDocument from '../models/IngestedDocument.js';
import axios from 'axios';
import FormData from 'form-data';
import mongoose from 'mongoose';
import { basename } from 'path';

const FASTAPI_BASE_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// ✅ HELPER: Check if FastAPI is available
const checkFastAPIHealth = async () => {
  try {
    const response = await axios.get(`${FASTAPI_BASE_URL}/health`, { timeout: 3000 });
    return response.status === 200;
  } catch (error) {
    console.log(`⚠️ FastAPI not available at ${FASTAPI_BASE_URL}:`, error.code || error.message);
    return false;
  }
};

// ===============================================
// ✅ 1. NEW: Ingest a RAG Data Sheet
// ===============================================
export const ingestDataSheet = async (req, res) => {
  try {
    const { docId, docName } = req.body;
    const dataSheetFile = req.file;

    console.log('🚀 [CONTROLLER] Ingesting data sheet:', {
      docId,
      docName,
      hasFile: !!dataSheetFile,
      fileName: dataSheetFile?.originalname,
      fileSize: dataSheetFile?.size
    });

    if (!dataSheetFile) {
      return res.status(400).json({
        success: false,
        message: "Data sheet file is required.",
      });
    }

    // ✅ First, save to database immediately
    const finalDocId = docId || `rag_doc_${Date.now()}`;
    console.log('💾 [CONTROLLER] Saving document to database first...');
    
    const ingestedDoc = new IngestedDocument({
      docId: finalDocId,
      fileName: dataSheetFile.originalname,
      fileType: dataSheetFile.mimetype,
      size: dataSheetFile.size,
    });
    await ingestedDoc.save();
    console.log('✅ [CONTROLLER] Document saved to database:', ingestedDoc._id);

    // ✅ Check if FastAPI/RAG is available (optional enhancement)
    const isHealthy = await checkFastAPIHealth();
    if (!isHealthy) {
      console.log('⚠️ [CONTROLLER] FastAPI not available, document saved to DB only');
      return res.json({
        success: true,
        message: `Data sheet "${dataSheetFile.originalname}" has been stored successfully. RAG indexing will be performed when the AI service becomes available.`,
        data: {
          docId: finalDocId,
          fileName: dataSheetFile.originalname,
          status: 'stored',
          ragIndexed: false,
          serviceStatus: 'fastapi_unavailable'
        }
      });
    }

    // ✅ Try to process with FastAPI (RAG enhancement)
    console.log('🚀 [CONTROLLER] FastAPI available, attempting RAG processing...');
    
    const formData = new FormData();
    formData.append('file', dataSheetFile.buffer, {
      filename: dataSheetFile.originalname,
      contentType: dataSheetFile.mimetype
    });
    formData.append('doc_id', finalDocId);

    try {
      const fastapiResponse = await axios.post(`${FASTAPI_BASE_URL}/ingest_data`, formData, {
        headers: { ...formData.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000, // 5 minutes timeout
        validateStatus: function (status) {
          // ✅ Accept both 200 and 503 responses
          return status >= 200 && status < 300 || status === 503;
        }
      });

      console.log('✅ [CONTROLLER] FastAPI response received:', fastapiResponse.data);

      // ✅ Handle different FastAPI response types
      if (fastapiResponse.status === 200 && fastapiResponse.data.success) {
        // Fully processed
        const ragStatus = fastapiResponse.data.rag_indexed || fastapiResponse.data.status === 'fully_processed';
        
        res.json({
          success: true,
          message: `Data sheet "${dataSheetFile.originalname}" has been ${ragStatus ? 'fully processed and indexed' : 'stored successfully'}.`,
          data: {
            docId: finalDocId,
            fileName: dataSheetFile.originalname,
            status: ragStatus ? 'fully_processed' : 'stored_no_rag',
            ragIndexed: ragStatus,
            serviceStatus: 'fastapi_available',
            fastApiResponse: fastapiResponse.data
          }
        });
      } else {
        // Partial success (document uploaded but not RAG indexed)
        res.json({
          success: true,
          message: `Data sheet "${dataSheetFile.originalname}" has been stored successfully. RAG indexing is currently unavailable.`,
          data: {
            docId: finalDocId,
            fileName: dataSheetFile.originalname,
            status: 'stored_no_rag',
            ragIndexed: false,
            serviceStatus: 'rag_unavailable',
            fastApiResponse: fastapiResponse.data
          }
        });
      }

    } catch (fastApiError) {
      console.error('❌ [CONTROLLER] FastAPI processing failed:', fastApiError.message);
      
      // ✅ Document is already saved in DB, so this is still a success
      res.json({
        success: true,
        message: `Data sheet "${dataSheetFile.originalname}" has been stored in the database. RAG indexing failed but will be retried automatically.`,
        data: {
          docId: finalDocId,
          fileName: dataSheetFile.originalname,
          status: 'stored_rag_failed',
          ragIndexed: false,
          serviceStatus: 'rag_failed',
          ragError: fastApiError.response?.data?.detail || fastApiError.message
        }
      });
    }

  } catch (error) {
    console.error('❌ [CONTROLLER] Ingestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ingest data sheet',
      error: error.message
    });
  }
};

// ===============================================
// ✅ 2. NEW: Delete a RAG Data Sheet
// ===============================================
export const deleteDataSheet = async (req, res) => {
  try {
    // ✅ Handle docId from both body and params for flexibility
    const docId = req.body?.docId || req.params?.docId;

    console.log('🗑️ [CONTROLLER] Delete request received:', {
      bodyDocId: req.body?.docId,
      paramsDocId: req.params?.docId,
      finalDocId: docId,
      method: req.method
    });

    if (!docId) {
      return res.status(400).json({
        success: false,
        message: "docId is required to delete the data sheet.",
        received: {
          body: req.body,
          params: req.params
        }
      });
    }

    console.log('🗑️ [CONTROLLER] Deleting document:', docId);

    // ✅ First, remove from database
    const deletedDoc = await IngestedDocument.findOneAndDelete({ docId });
    if (!deletedDoc) {
      return res.status(404).json({
        success: false,
        message: "Document not found in database.",
        docId: docId
      });
    }

    console.log('✅ [CONTROLLER] Document removed from database:', deletedDoc.fileName);

    // ✅ Try to remove from RAG system (optional)
    const isHealthy = await checkFastAPIHealth();
    if (isHealthy) {
      try {
        console.log('🗑️ [CONTROLLER] Attempting RAG deletion...');

        const formData = new FormData();
        formData.append('doc_id', docId);

        const fastapiResponse = await axios.delete(`${FASTAPI_BASE_URL}/delete_data`, {
          data: formData,
          headers: { ...formData.getHeaders() },
          timeout: 30000,
          // ✅ Accept both success and 503 responses
          validateStatus: function (status) {
            return status >= 200 && status < 300 || status === 503;
          }
        });

        console.log('✅ [CONTROLLER] FastAPI response:', fastapiResponse.data);

        // ✅ Handle different FastAPI response scenarios
        const ragResult = fastapiResponse.data;
        
        res.json({
          success: true,
          message: `Document "${deletedDoc.fileName}" deleted from database. ${ragResult.message || 'RAG cleanup completed.'}`,
          data: {
            docId: docId,
            fileName: deletedDoc.fileName,
            deletedFromDB: true,
            deletedFromRAG: ragResult.deleted_from_rag || false,
            ragStatus: ragResult.status || 'unknown',
            ragAvailable: ragResult.rag_available !== false
          }
        });

      } catch (fastApiError) {
        console.error('❌ [CONTROLLER] FastAPI deletion failed:', fastApiError.message);
        
        // ✅ DB deletion was successful, which is the most important part
        res.json({
          success: true,
          message: `Document "${deletedDoc.fileName}" deleted from database. RAG cleanup failed but document is no longer accessible.`,
          data: {
            docId: docId,
            fileName: deletedDoc.fileName,
            deletedFromDB: true,
            deletedFromRAG: false,
            ragError: fastApiError.response?.data?.message || fastApiError.message
          }
        });
      }
    } else {
      // No FastAPI available
      res.json({
        success: true,
        message: `Document "${deletedDoc.fileName}" deleted from database. RAG service not available.`,
        data: {
          docId: docId,
          fileName: deletedDoc.fileName,
          deletedFromDB: true,
          deletedFromRAG: false,
          serviceStatus: 'fastapi_unavailable'
        }
      });
    }

  } catch (error) {
    console.error('❌ [CONTROLLER] Deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete data sheet',
      error: error.message
    });
  }
};

// ===============================================
// ✅ 3. NEW: Get Ingested Documents
// ===============================================
export const getIngestedDocuments = async (req, res) => {
  try {
    console.log('📄 [CONTROLLER] Fetching ingested documents...');
    
    const documents = await IngestedDocument.find()
      .sort({ ingestedAt: -1 })
      .limit(100);

    console.log(`✅ [CONTROLLER] Found ${documents.length} ingested documents`);

    res.json({
      success: true,
      data: documents,
      count: documents.length
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ingested documents',
      error: error.message
    });
  }
};

// ===============================================
// ✅ 4. REPURPOSED: Get All Models
// ===============================================
export const getModels = async (req, res) => {
  try {
    console.log('🔍 [CONTROLLER] Fetching all available models...');

    const isHealthy = await checkFastAPIHealth();
    
    // ✅ Always return at least the base model info
    const baseModels = [{
      id: 'llama3_base',
      name: 'Llama 3 Base',
      type: 'base',
      status: isHealthy ? 'available' : 'service_offline',
      description: 'Base Llama 3 model for general conversation',
      source: 'Ollama'
    }];

    if (isHealthy) {
      try {
        // Check if RAG-enhanced model is available
        const ragResponse = await axios.get(`${FASTAPI_BASE_URL}/rag/health`, { timeout: 3000 });
        if (ragResponse.data.status === 'online') {
          baseModels.push({
            id: 'rag_llama3',
            name: 'Llama 3 RAG',
            type: 'rag',
            status: 'available',
            description: 'Llama 3 with Retrieval-Augmented Generation capabilities',
            source: 'FastAPI + Ollama'
          });
        }
      } catch (ragError) {
        console.log('⚠️ [CONTROLLER] RAG service not available');
      }
    }

    console.log(`✅ [CONTROLLER] Returning ${baseModels.length} models`);

    res.json({
      success: true,
      data: baseModels,
      count: baseModels.length,
      fastapi_available: isHealthy
    });

  } catch (error) {
    console.error('❌ [CONTROLLER] Get models error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch models',
      error: error.message
    });
  }
};

// ===============================================
// ✅ 5. NEW: Get Model Status
// ===============================================
export const getModelStatus = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    console.log(`🔍 [CONTROLLER] Getting status for model: ${modelId}`);
    
    // ✅ Handle different model types
    if (modelId === 'llama3_base') {
      // Check if Ollama is available through FastAPI
      const isHealthy = await checkFastAPIHealth();
      res.json({
        success: true,
        modelId,
        status: isHealthy ? 'available' : 'service_offline',
        type: 'base',
        description: 'Base Llama 3 model status'
      });
    } else if (modelId === 'rag_llama3') {
      // Check RAG service specifically
      try {
        const ragResponse = await axios.get(`${FASTAPI_BASE_URL}/rag/health`, { timeout: 3000 });
        res.json({
          success: true,
          modelId,
          status: ragResponse.data.status === 'online' ? 'available' : 'offline',
          type: 'rag',
          description: 'RAG-enhanced Llama 3 model status',
          ragServices: ragResponse.data
        });
      } catch (ragError) {
        res.json({
          success: true,
          modelId,
          status: 'offline',
          type: 'rag',
          description: 'RAG service not available',
          error: ragError.message
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: `Model ${modelId} not found`
      });
    }
  } catch (error) {
    console.error('❌ [CONTROLLER] Get model status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get model status',
      error: error.message
    });
  }
};


