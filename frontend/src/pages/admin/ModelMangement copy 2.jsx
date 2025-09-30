import React, { useState, useEffect, useCallback } from 'react';
import {
  IconDatabase, IconRobot, IconPlus, IconTrash, IconCheck,
  IconAlertCircle, IconRefresh, IconX, IconUpload, IconLoader,
  IconBrain, IconEye, IconFile
} from '@tabler/icons-react';
import { useModelManagement } from '../../context/ModelContext';

const ModelManagement = () => {
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

  return (
    <div className="p-6 bg-green-50 min-h-screen">
      {/* Header */}
      <h2 className="text-green-900 font-bold text-xl mb-6 flex justify-between items-center">
        <span className="flex items-center gap-2">
          <IconBrain size={24} />
          AI Model Management
        </span>
        <button
          onClick={fetchData}
          className="bg-green-700 text-white px-3 py-2 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
          disabled={ingestionLoading || modelLoading}
        >
          <IconRefresh size={16} />
          {ingestionLoading || modelLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </h2>

      {/* Notifications */}
      {notifications.map((notification, index) => (
        <div
          key={`${notification.id}-${index}`}
          className={`p-4 rounded-lg mb-4 flex justify-between items-center ${
            notification.type === 'error'
              ? 'bg-red-100 border border-red-300 text-red-800'
              : notification.type === 'warning'
              ? 'bg-yellow-100 border border-yellow-300 text-yellow-800'
              : 'bg-blue-100 border border-blue-300 text-blue-800'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => removeNotification(notification.id)}
            className="hover:opacity-75"
          >
            <IconX size={20} />
          </button>
        </div>
      ))}
      
      {/* RAG Service Status Alert */}
      <div className={`rounded-lg p-4 mb-6 ${
        ragStatus.available
          ? 'bg-green-50 border border-green-200' 
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <div className="flex items-start gap-3">
          <IconAlertCircle size={20} className={
            ragStatus.available
              ? 'text-green-600 mt-0.5 flex-shrink-0' 
              : 'text-yellow-600 mt-0.5 flex-shrink-0'
          } />
          <div>
            <h4 className={`font-medium mb-1 ${
              ragStatus.available
                ? 'text-green-800' 
                : 'text-yellow-800'
            }`}>
              RAG System Status
            </h4>
            {ragStatus.available ? (
              <div>
                <p className="text-green-700 text-sm mb-2">
                  ✅ RAG system is active! Your uploaded documents can be searched by AI.
                </p>
                <div className="text-xs text-green-600">
                  <p>✅ Document Upload: Working</p>
                  <p>✅ RAG Indexing: Available</p>
                  <p>✅ AI Document Search: Available</p>
                  <p>✅ Smart Query Detection: Enabled</p>
                </div>
                {Array.isArray(ingestedDocuments) && ingestedDocuments.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    📄 {ingestedDocuments.length} document(s) available for AI search
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-yellow-700 text-sm mb-2">
                  ⚠️ RAG system is not fully available. Documents will be stored but AI search won't work.
                </p>
                <div className="text-xs text-yellow-600">
                  <p>✅ Document Upload: Working</p>
                  <p>❌ RAG Indexing: Not Available</p>
                  <p>❌ AI Document Search: Not Available</p>
                  <p>✅ Basic Chat: Working</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b border-green-100">
          <button
            onClick={() => setActiveTab('data')}
            className={`px-6 py-4 font-medium flex-1 flex items-center justify-center gap-2 ${
              activeTab === 'data'
                ? 'text-black border-b-2 border-green-700 bg-green-25'
                : 'text-green-600 hover:text-black hover:bg-green-25'
            }`}
          >
            <IconDatabase size={16} />
            Data Sheets ({Array.isArray(ingestedDocuments) ? ingestedDocuments.length : 0})
          </button>
          <button
            onClick={() => setActiveTab('model')}
            className={`px-6 py-4 font-medium flex-1 flex items-center justify-center gap-2 ${
              activeTab === 'model'
                ? 'text-black border-b-2 border-green-700 bg-green-25'
                : 'text-green-600 hover:text-black hover:bg-green-25'
            }`}
          >
            <IconRobot size={16} />
            AI Model Status
          </button>
        </div>

        {/* Data Management Tab */}
        {activeTab === 'data' && (
          <div className="p-6">
            <h3 className="text-green-800 font-semibold text-lg mb-4">Ingest New Data Sheet</h3>
            <form onSubmit={handleIngestDataSheet} className="bg-green-50 p-6 rounded-lg border border-green-200 mb-6">
              <div className="mb-6">
                <label className="block text-black font-medium mb-2">Upload Data Sheet File</label>
                <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center">
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
                      <IconUpload size={48} className="text-green-400 mb-2" />
                      <p className="text-black font-medium">Click to upload data sheet</p>
                      <p className="text-green-600 text-sm mt-1">
                        Supports PDF, PNG, JPG, JPEG files
                      </p>
                    </label>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <IconCheck size={24} className="text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">{ingestionForm.dataSheetFile.name}</p>
                        <p className="text-green-600 text-sm">
                          {(ingestionForm.dataSheetFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleIngestionFormChange('dataSheetFile', null)}
                        className="text-red-600 hover:text-red-800 ml-4"
                      >
                        <IconX size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="submit"
                  disabled={!ingestionForm.dataSheetFile || ingestionLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2"
                >
                  {ingestionLoading ? (
                    <>
                      <IconLoader size={16} className="animate-spin" />
                      Ingesting...
                    </>
                  ) : (
                    <>
                      <IconPlus size={16} />
                      Ingest Data
                    </>
                  )}
                </button>
              </div>
            </form>

            <h3 className="text-green-800 font-semibold text-lg mb-4">Ingested Documents</h3>
            {(!Array.isArray(ingestedDocuments) || ingestedDocuments.length === 0) ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <IconFile size={64} className="mx-auto text-green-300 mb-4" />
                <p className="text-green-800 text-lg">No documents have been ingested yet.</p>
                <p className="text-green-600 text-sm mt-2">Upload a file using the form above to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-green-100">
                {Array.isArray(ingestedDocuments) && ingestedDocuments.map((doc) => (
                  <div key={doc.docId} className="py-4 flex items-center justify-between hover:bg-green-25 px-2 rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-black">{doc.fileName}</p>
                        {/* ✅ Add status indicator */}
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                          📄 Stored
                        </span>
                      </div>
                      <p className="text-sm text-green-600">ID: {doc.docId}</p>
                      <p className="text-sm text-green-600">
                        Uploaded: {new Date(doc.ingestedAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-green-600">
                        Size: {(doc.size / 1024 / 1024).toFixed(2)} MB • Type: {doc.fileType}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => handleDeleteDataSheet(doc.docId)}
                        disabled={ingestionLoading}
                        className="p-2 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                      >
                        <IconTrash size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Model Status Tab */}
        {activeTab === 'model' && (
          <div className="p-6">
            <h3 className="text-green-800 font-semibold text-lg mb-4">AI Model Status</h3>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center gap-4 mb-4">
                <IconRobot size={28} className="text-green-600" />
                <h4 className="font-semibold text-lg text-black">Llama 3 RAG Model</h4>
              </div>
              <div className="border-t border-green-100 pt-4">
                <p className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    Active and Ready
                  </span>
                </p>
                <p className="flex items-center gap-2 mt-2">
                  <span className="font-medium">Description:</span>
                  <span className="text-sm text-green-600">
                    This model is an instance of Llama 3 with Retrieval-Augmented Generation capabilities.
                    It can answer questions based on ingested company data sheets.
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelManagement;
