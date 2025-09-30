import React, { useState, useEffect, useCallback } from 'react';
import {
  IconDatabase, IconRobot, IconPlus, IconTrash, IconCheck,
  IconAlertCircle, IconRefresh, IconX, IconUpload, IconLoader,
  IconBrain, IconEye, IconFile, IconArrowLeft
} from '@tabler/icons-react';
import { useModelManagement } from '../../context/ModelContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

const ModelManagement = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const { 
    ingestedDocuments,
    ingestionLoading,
    modelStatus,
    modelLoading,
    error,
    notifications,
    getIngestedDocuments,
    ingestDataSheet,
    deleteDataSheet,
    getModels,
    getModelStatus,
    clearError,
    removeNotification,
    ragStatus,
    getRagStatus
  } = useModelManagement();

  const [activeTab, setActiveTab] = useState('data');
  const [ingestionForm, setIngestionForm] = useState({
    docId: '',
    dataSheetFile: null,
  });

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      await Promise.all([
        getIngestedDocuments(),
        getModels(),
        getRagStatus(),
      ]);
    } catch (error) {
      console.error('❌ [MODEL MANAGEMENT] Fetch error:', error);
    }
  }, [getIngestedDocuments, getModels, getRagStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle ingestion form input
  const handleIngestionFormChange = (field, value) => {
    setIngestionForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle data sheet ingestion
  const handleIngestDataSheet = async (e) => {
    e.preventDefault();
    if (!ingestionForm.dataSheetFile) {
      alert("Please select a data sheet file.");
      return;
    }
    const docId = `doc_${Date.now()}`;
    try {
      const result = await ingestDataSheet(docId, ingestionForm.dataSheetFile);
      if (result.success) {
        setIngestionForm({ docId: '', dataSheetFile: null });
      }
    } catch (error) {
      console.error("Data ingestion failed:", error);
    }
  };

  // Handle data sheet deletion
  const handleDeleteDataSheet = async (docId) => {
    if (window.confirm(`Are you sure you want to delete this document? This action cannot be undone.`)) {
      try {
        console.log('🗑️ [FRONTEND] Attempting to delete document:', docId);
        const result = await deleteDataSheet(docId);
        console.log('✅ [FRONTEND] Delete result:', result);
      } catch (error) {
        console.error("❌ [FRONTEND] Data deletion failed:", error);
        console.error("Error details:", error.response?.data);
        
        // Show user-friendly error message
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error occurred';
        alert(`Delete failed: ${errorMessage}`);
      }
    }
  };

  // Wrap the return content:
  return (
    <div className="min-h-screen"
         style={{ backgroundColor: isDark ? '#0a0a0a' : '#fafafa' }}>
      
      {/* ✅ Main Content */}
      <div className="flex-1 lg:ml-0">
        {/* ✅ SEAMLESS HEADER - Same as Users */}
        <div className="z-10 backdrop-blur-xl border-b"
             style={{ 
               backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(250, 250, 250, 0.8)',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              
              {/* Left Section */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  <IconArrowLeft size={16} />
                  <span className="hidden sm:inline">Back</span>
                </button>

                <div>
                  <h1 className="text-xl sm:text-2xl font-bold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    AI Model Management
                  </h1>
                  <p className="text-xs sm:text-sm"
                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Manage documents and AI models
                  </p>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchData}
                  disabled={ingestionLoading || modelLoading}
                  className="px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 text-sm"
                  style={{ 
                    backgroundColor: isDark ? '#ffffff' : '#000000',
                    color: isDark ? '#000000' : '#ffffff'
                  }}
                >
                  <IconRefresh size={16} className={ingestionLoading || modelLoading ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* ✅ NOTIFICATIONS - Seamless */}
          {notifications.length > 0 && (
            <div className="mb-6 space-y-4">
              {notifications.map((notification, index) => (
                <div
                  key={`${notification.id}-${index}`}
                  className={`p-4 rounded-2xl flex justify-between items-center border-0 ${
                    notification.type === 'error'
                      ? 'bg-red-500/10 text-red-400'
                      : notification.type === 'warning'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  <span>{notification.message}</span>
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="hover:opacity-75 p-1 rounded-lg transition-colors"
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <IconX size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* ✅ RAG STATUS - Seamless */}
          <div className={`mb-6 rounded-2xl p-6 border-0 ${
            ragStatus?.available
              ? 'bg-green-500/10'
              : 'bg-yellow-500/10'
          }`}>
            <div className="flex items-start gap-4">
              <IconAlertCircle size={24} className={
                ragStatus?.available
                  ? 'text-green-400 flex-shrink-0'
                  : 'text-yellow-400 flex-shrink-0'
              } />
              <div className="flex-1">
                <h4 className={`font-semibold text-lg mb-3 ${
                  ragStatus?.available
                    ? 'text-green-400'
                    : 'text-yellow-400'
                }`}>
                  RAG System Status
                </h4>
                {ragStatus?.available ? (
                  <div>
                    <p className="mb-4 text-green-300">
                      ✅ RAG system is active! Your uploaded documents can be searched by AI.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-green-400">
                      <div className="flex items-center gap-2">
                        <IconCheck size={16} />
                        <span>Document Upload: Working</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconCheck size={16} />
                        <span>RAG Indexing: Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconCheck size={16} />
                        <span>AI Document Search: Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconCheck size={16} />
                        <span>Smart Query Detection: Enabled</span>
                      </div>
                    </div>
                    {Array.isArray(ingestedDocuments) && ingestedDocuments.length > 0 && (
                      <p className="mt-3 text-sm text-green-400">
                        📄 {ingestedDocuments.length} document(s) available for AI search
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="mb-4 text-yellow-300">
                      ⚠️ RAG system is not fully available. Documents will be stored but AI search won't work.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-yellow-400">
                      <div className="flex items-center gap-2">
                        <IconCheck size={16} />
                        <span>Document Upload: Working</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconX size={16} />
                        <span>RAG Indexing: Not Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconX size={16} />
                        <span>AI Document Search: Not Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconCheck size={16} />
                        <span>Basic Chat: Working</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ✅ MAIN CONTENT CARD - Seamless like Users */}
          <div className="rounded-2xl overflow-hidden"
               style={{ 
                 backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                 backdropFilter: 'blur(10px)',
                 border: 'none'
               }}>
            
            {/* Tabs - Seamless */}
            <div className="flex border-b border-opacity-10"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                   borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                 }}>
              <button
                onClick={() => setActiveTab('data')}
                className="px-6 py-4 font-medium flex-1 flex items-center justify-center gap-2 transition-all"
                style={{
                  color: activeTab === 'data' 
                    ? isDark ? '#ffffff' : '#000000'
                    : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                  backgroundColor: activeTab === 'data' 
                    ? isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
                    : 'transparent',
                  borderBottom: activeTab === 'data' 
                    ? `2px solid ${isDark ? '#ffffff' : '#000000'}`
                    : 'none'
                }}
              >
                <IconDatabase size={18} />
                Data Sheets ({Array.isArray(ingestedDocuments) ? ingestedDocuments.length : 0})
              </button>
              <button
                onClick={() => setActiveTab('model')}
                className="px-6 py-4 font-medium flex-1 flex items-center justify-center gap-2 transition-all"
                style={{
                  color: activeTab === 'model' 
                    ? isDark ? '#ffffff' : '#000000'
                    : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                  backgroundColor: activeTab === 'model' 
                    ? isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
                    : 'transparent',
                  borderBottom: activeTab === 'model' 
                    ? `2px solid ${isDark ? '#ffffff' : '#000000'}`
                    : 'none'
                }}
              >
                <IconRobot size={18} />
                AI Model Status
              </button>
            </div>

            {/* ✅ DATA MANAGEMENT TAB */}
            {activeTab === 'data' && (
              <div className="p-6 space-y-6">
                
                {/* Upload Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Upload New Document
                  </h3>
                  <form onSubmit={handleIngestDataSheet} 
                        className="p-6 rounded-2xl"
                        style={{ 
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          border: 'none'
                        }}>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-3"
                             style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                        Select File to Upload
                      </label>
                      <div className="border-2 border-dashed rounded-2xl p-8 text-center transition-colors"
                           style={{ 
                             borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                             backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
                           }}>
                        <input
                          type="file"
                          id="dataSheetFile"
                          accept=".pdf, .png, .jpg, .jpeg"
                          onChange={(e) => handleIngestionFormChange('dataSheetFile', e.target.files[0])}
                          className="hidden"
                        />
                        {!ingestionForm.dataSheetFile ? (
                          <label
                            htmlFor="dataSheetFile"
                            className="cursor-pointer flex flex-col items-center"
                          >
                            <IconUpload size={48} style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} className="mb-3" />
                            <p className="font-medium mb-2"
                               style={{ color: isDark ? '#ffffff' : '#000000' }}>
                              Click to upload document
                            </p>
                            <p className="text-sm"
                               style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                              Supports PDF, PNG, JPG, JPEG files
                            </p>
                          </label>
                        ) : (
                          <div className="flex items-center justify-center gap-4">
                            <IconCheck size={32} className="text-green-400" />
                            <div className="text-left">
                              <p className="font-medium"
                                 style={{ color: isDark ? '#ffffff' : '#000000' }}>
                                {ingestionForm.dataSheetFile.name}
                              </p>
                              <p className="text-sm"
                                 style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {(ingestionForm.dataSheetFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleIngestionFormChange('dataSheetFile', null)}
                              className="p-2 rounded-lg transition-colors bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            >
                              <IconX size={20} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!ingestionForm.dataSheetFile || ingestionLoading}
                        className="px-6 py-3 rounded-xl font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50"
                        style={{ 
                          backgroundColor: isDark ? '#ffffff' : '#000000',
                          color: isDark ? '#000000' : '#ffffff'
                        }}
                      >
                        {ingestionLoading ? (
                          <>
                            <IconLoader size={18} className="animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <IconPlus size={18} />
                            Upload Document
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Documents List */}
                <div>
                  <h3 className="text-lg font-semibold mb-4"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Uploaded Documents
                  </h3>
                  {(!Array.isArray(ingestedDocuments) || ingestedDocuments.length === 0) ? (
                    <div className="text-center py-12 rounded-2xl"
                         style={{ 
                           backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                         }}>
                      <IconFile size={64} style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} className="mx-auto mb-4" />
                      <h4 className="text-lg font-medium mb-2"
                          style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        No documents uploaded yet
                      </h4>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Upload a file using the form above to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.isArray(ingestedDocuments) && ingestedDocuments.map((doc) => (
                        <div key={doc.docId} 
                             className="p-4 rounded-2xl transition-all hover:scale-[1.01]"
                             style={{ 
                               backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                             }}
                             onMouseEnter={(e) => {
                               e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
                             }}
                             onMouseLeave={(e) => {
                               e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                             }}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <IconFile size={20} style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }} className="mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium truncate"
                                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                                    {doc.fileName}
                                  </h4>
                                  <span className="px-2 py-1 text-xs rounded-lg font-medium flex-shrink-0 bg-green-500/10 text-green-400">
                                    📄 Stored
                                  </span>
                                </div>
                                <div className="space-y-1 text-sm"
                                     style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                  <p>ID: {doc.docId}</p>
                                  <p>Uploaded: {new Date(doc.ingestedAt).toLocaleDateString()}</p>
                                  <p>Size: {(doc.size / 1024 / 1024).toFixed(2)} MB • Type: {doc.fileType}</p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteDataSheet(doc.docId)}
                              disabled={ingestionLoading}
                              className="p-2 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            >
                              <IconTrash size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ MODEL STATUS TAB */}
            {activeTab === 'model' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-6"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  AI Model Status
                </h3>
                <div className="p-6 rounded-2xl"
                     style={{ 
                       backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                     }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl"
                         style={{
                           backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                           color: isDark ? '#ffffff' : '#000000'
                         }}>
                      <IconRobot size={32} />
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold"
                          style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        Llama 3 RAG Model
                      </h4>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Retrieval-Augmented Generation System
                      </p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-6 space-y-4"
                       style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium"
                            style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        Status:
                      </span>
                      <span className="px-3 py-1 text-sm rounded-lg font-medium bg-green-500/10 text-green-400">
                        Active and Ready
                      </span>
                    </div>
                    <div>
                      <span className="font-medium block mb-2"
                            style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        Description:
                      </span>
                      <p className="text-sm leading-relaxed"
                         style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        This model is an instance of Llama 3 with Retrieval-Augmented Generation capabilities.
                        It can answer questions based on ingested company data sheets and provide contextual responses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelManagement;
