import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { 
  IconBrain, IconCheck, IconClock, IconLoader, 
  IconSettings, IconX,  IconRefresh, IconAlertCircle,
  IconChevronDown, IconChevronUp, IconDownload, IconTrash, IconPlus,
  IconDatabase, IconRobot, IconEye, IconUpload
} from '@tabler/icons-react';
import { useModelManagement } from '../../context/ModelContext';
import { useUser } from '../../context/UserContext';

const ModelManagement = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { 
    trainingJobs,
    loadedModels,
    // ✅ NEW STATES & FUNCTIONS
    availableAdapters,
    modelStatus,
    trainingLoading,
    modelLoading,
    error,
    notifications,
    startModelTraining,
    startLoRATraining,      // ✅ NEW
    getTrainingJobs,
    cancelTraining,
    loadLoRAAdapter,        // ✅ NEW
    unloadModel,
    getLoadedModels,
    getAvailableAdapters,   // ✅ NEW
    getModelStatus,
    clearError,
    removeNotification
  } = useModelManagement();

  // Use Vite env for backend URL
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // ✅ CREATE AXIOS INSTANCE WITH CLERK TOKEN
  const createApiClient = async () => {
    const token = await getToken();
    const axios = (await import('axios')).default;
    return axios.create({
      baseURL: `${API_BASE}/api/admin`,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    });
  };

  // Local state
  const [trainingForms, setTrainingForms] = useState({});
  const [loadingForms, setLoadingForms] = useState({});
  const [startingTraining, setStartingTraining] = useState(null);
  const [expandedTraining, setExpandedTraining] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [successMessage, setSuccessMessage] = useState('');
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [showLoadingForm, setShowLoadingForm] = useState(false);
  const [activeTab, setActiveTab] = useState('training'); // 'training' or 'models'
  const [training, setTraining] = useState({ training: false });
  const [selectedBaseModel, setSelectedBaseModel] = useState('llama3'); // ✅ NEW STATE

  const prevCompletedCount = useRef(0);

  // Load data on mount
  const fetchData = useCallback(async () => {
    try {
      console.log('📊 [MODEL MANAGEMENT] Fetching data...');
      await Promise.all([
        getTrainingJobs(),
        getLoadedModels(),
        getAvailableAdapters() // ✅ NEW
      ]);
      console.log('✅ [MODEL MANAGEMENT] Data fetched successfully');
    } catch (error) {
      console.error('❌ [MODEL MANAGEMENT] Fetch error:', error);
    }
  }, [getTrainingJobs, getLoadedModels, getAvailableAdapters]); // ✅ NEW DEPENDENCY

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // If any job just completed, refresh data
  useEffect(() => {
    const completedCount = trainingJobs.filter(job => job.status === 'completed').length;
    if (completedCount > prevCompletedCount.current) {
      fetchData(); // Only refresh when a new job completes
    }
    prevCompletedCount.current = completedCount;
  }, [trainingJobs, fetchData]);

  // Handle training form input
  const handleTrainingFormChange = (field, value) => {
    setTrainingForms(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle model loading form input
  const handleLoadingFormChange = (field, value) => {
    setLoadingForms(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ FIXED: Handle LoRA training submission
  const handleLoRATraining = async (jobId) => {
    try {
      // ✅ FIX: Check both global and per-job form data
      const formData = trainingForms[jobId] || trainingForms;
      const datasetFile = formData?.datasetFile || formData?.selectedFile;
      
      console.log('🔍 [DEBUG] Form data check:', {
        jobId,
        hasJobSpecificForm: !!trainingForms[jobId],
        hasGlobalForm: !!trainingForms.selectedFile,
        formData,
        datasetFile: datasetFile?.name || 'none'
      });
      
      if (!datasetFile) {
        console.error('❌ [DEBUG] No dataset file found:', {
          trainingForms,
          jobId,
          formDataKeys: Object.keys(trainingForms)
        });
        alert('❌ Please select a dataset file first.');
        return;
      }

      console.log('🚀 [FRONTEND] Starting LoRA training for:', jobId);
      setStartingTraining(jobId);

      // ✅ Pass data as object (not FormData)
      const trainingData = {
        jobId: jobId,
        datasetFile: datasetFile, // ✅ Use the found dataset file
        base_model: formData.base_model || selectedBaseModel || 'llama3',
        parameters: {
          epochs: formData.epochs || trainingForms.epochs || 3,
          learningRate: formData.learningRate || trainingForms.learningRate || 0.0002,
          loraRank: formData.loraRank || trainingForms.loraRank || 16,
          loraAlpha: formData.loraAlpha || trainingForms.loraAlpha || 32,
          ...formData.parameters
        }
      };

      console.log('📋 [FRONTEND] Training data:', trainingData);

      const result = await startLoRATraining(trainingData);

      if (result.success) {
        alert('✅ LoRA training started successfully!');
        // Clear both forms
        setTrainingForms(prev => ({
          ...prev,
          [jobId]: {}, // Clear job-specific form
          selectedFile: null, // Clear global form
          modelType: '',
          epochs: '',
          learningRate: '',
          loraRank: '',
          loraAlpha: ''
        }));
      } else {
        alert(`❌ Failed to start training: ${result.message}`);
      }

    } catch (error) {
      console.error('❌ [FRONTEND] LoRA training start failed:', error);
      
      let errorMessage = 'Failed to start LoRA training';
      if (error.response?.status === 401) {
        errorMessage = '🔐 Authentication failed. Please sign out and sign in again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ ${errorMessage}`);
    } finally {
      setStartingTraining(null);
    }
  };

  // ✅ UPDATED: Handle training submission for all types
  const handleTrainingSubmit = async () => {
    const { modelType, selectedFile } = trainingForms;

    if (!modelType || !selectedFile) {
      alert("Please select a model type and upload a dataset file.");
      return;
    }

    if (modelType === 'lora') {
      // ✅ For LoRA, generate a job ID and call LoRA handler
      const jobId = `lora-${Date.now()}`;
      
      // ✅ Store the file in the job-specific form data
      setTrainingForms(prev => ({
        ...prev,
        [jobId]: {
          datasetFile: selectedFile, // ✅ Store in job-specific location
          base_model: selectedBaseModel,
          epochs: prev.epochs,
          learningRate: prev.learningRate,
          loraRank: prev.loraRank,
          loraAlpha: prev.loraAlpha,
          parameters: {
            epochs: prev.epochs || 3,
            learningRate: prev.learningRate || 0.0002,
            loraRank: prev.loraRank || 16,
            loraAlpha: prev.loraAlpha || 32
          }
        }
      }));
      
      // ✅ Wait a moment for state to update, then call LoRA handler
      setTimeout(() => {
        handleLoRATraining(jobId);
      }, 100);
      
      return;
    }

    try {
      setStartingTraining(true);
      
      const jobName = `${modelType}-${Date.now()}`;

      const result = await startModelTraining(jobName, selectedFile, modelType, {
        epochs: trainingForms.epochs || 3,
        learningRate: trainingForms.learningRate || 0.001,
        base_model: selectedBaseModel
      });
      
      if (result && result.success) {
        setSuccessMessage("Training started successfully!");
        setTrainingForms({});
        setShowTrainingForm(false);
        await fetchData();
      } else {
        alert("Training start failed: " + (result?.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Training start failed:", error);
      alert("Training start failed: " + (error.response?.data?.message || error.message));
    } finally {
      setStartingTraining(false);
    }
  };

  // Submit model loading
  const handleModelLoad = async () => {
    const { modelId, modelPath, modelType } = loadingForms;
    if (!modelId || !modelPath || !modelType) return;

    try {
      const result = await loadModel(modelId, {
        modelPath,
        modelType,
        parameters: {}
      });
      if (result && result.success) {
        setSuccessMessage(`Model ${modelId} loaded successfully!`);
        setLoadingForms({});
        setShowLoadingForm(false);
        await fetchData();
      }
    } catch (error) {
      console.error('Model load error:', error);
    }
  };

  // Cancel training
  const handleCancelTraining = async (jobId) => {
    try {
      const result = await cancelTraining(jobId);
      if (result && result.success) {
        setSuccessMessage('Training job cancelled successfully!');
        await fetchData();
      }
    } catch (error) {
      console.error('Cancel training error:', error);
    }
  };

  // Unload model
  const handleUnloadModel = async (modelId) => {
    try {
      console.log('🗑️ [FRONTEND] Unloading model:', modelId);
      
      const result = await unloadModel(modelId);
      
      // ✅ Handle different response types
      if (result.success) {
        alert(`✅ Model "${modelId}" unloaded successfully!`);
        // Refresh the models list
        await getLoadedModels();
      } else {
        // Handle specific error types
        switch (result.error_type) {
          case 'base_model_unload':
            alert(`ℹ️ Base models cannot be unloaded.\n\n${result.message}`);
            break;
          case 'model_not_found':
            alert(`⚠️ Model not found.\n\n${result.message}\n\nRefreshing models list...`);
            // Refresh the models list since it might be out of sync
            await getLoadedModels();
            break;
          case 'unload_error':
            alert(`❌ Error unloading model.\n\n${result.message}`);
            break;
          default:
            alert(`❌ Failed to unload model.\n\n${result.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Unload error:', error);
      alert(`❌ Failed to unload model: ${error.message}`);
    }
  };

  // ✅ NEW: Handle LoRA adapter loading
  const handleLoadLoRAAdapter = async (adapterPath, adapterName) => {
    try {
      const result = await loadLoRAAdapter(adapterPath, selectedBaseModel);
      if (result && result.success) {
        setSuccessMessage(`LoRA adapter "${adapterName}" loaded successfully!`);
        await fetchData();
      }
    } catch (error) {
      console.error('Load LoRA adapter error:', error);
      alert("Failed to load LoRA adapter: " + (error.response?.data?.message || error.message));
    }
  };

  // Filter training jobs
  const filteredTrainingJobs = trainingJobs.filter(job => 
    statusFilter === 'all' || job.status === statusFilter
  );

  // Get status counts
  const statusCounts = trainingJobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, { pending: 0, running: 0, completed: 0, failed: 0 });

  const totalJobs = trainingJobs.length;
  const completionRate = totalJobs > 0 ? (statusCounts.completed / totalJobs * 100) : 0;

  return (
    <div className="p-6 bg-green-50 min-h-screen">
      {/* Header */}
      <h2 className="text-green-900 font-bold text-xl mb-6 flex justify-between items-center">
        <span className="flex items-center gap-2">
          <IconBrain size={24} />
          Model Management
        </span>
        <div className="flex gap-4">
          <button
            onClick={fetchData}
            className="bg-green-700 text-white px-3 py-2 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
            disabled={trainingLoading || modelLoading}
          >
            <IconRefresh size={16} />
            {trainingLoading || modelLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </h2>

      {/* Loading and Error States */}
      {(trainingLoading || modelLoading) && (
        <p className="text-black flex items-center gap-2 mb-4">
          <IconLoader className="animate-spin" size={16} />
          Loading model data...
        </p>
      )}
      
      {error && (
        <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-600 hover:text-red-800">
            <IconX size={20} />
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-green-600 hover:text-green-800">
            <IconX size={20} />
          </button>
        </div>
      )}

      {/* Notifications */}
      {notifications.map((notification, index) => (
        <div
          key={`${notification.id}-${index}`} // ✅ More unique key
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

      {/* Stats Cards */}
      {!trainingLoading && trainingJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Total Training Jobs</h3>
            <p className="text-2xl font-bold text-green-900">{totalJobs}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Running</h3>
            <p className="text-2xl font-bold text-blue-600">{statusCounts.running}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Completed</h3>
            <p className="text-2xl font-bold text-green-600">{statusCounts.completed}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-green-800 font-semibold mb-2">Success Rate</h3>
            <p className="text-2xl font-bold text-green-600">{completionRate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b border-green-100">
          <button
            onClick={() => setActiveTab('training')}
            className={`px-6 py-4 font-medium flex items-center gap-2 ${
              activeTab === 'training'
                ? 'text-black border-b-2 border-green-700 bg-green-25'
                : 'text-green-600 hover:text-black hover:bg-green-25'
            }`}
          >
            <IconBrain size={16} />
            Training Jobs ({trainingJobs.length})
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`px-6 py-4 font-medium flex items-center gap-2 ${
              activeTab === 'models'
                ? 'text-black border-b-2 border-green-700 bg-green-25'
                : 'text-green-600 hover:text-black hover:bg-green-25'
            }`}
          >
            <IconRobot size={16} />
            LoRA Models ({loadedModels.length})
          </button>
        </div>

        {/* Training Tab Content */}
        {activeTab === 'training' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-green-800 font-semibold text-lg">Training Management</h3>
              <div className="flex gap-4 items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-green-300 text-green-800 px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
                
                <button
                  onClick={() => setShowTrainingForm(!showTrainingForm)}
                  className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 flex items-center gap-2"
                >
                  <IconPlus size={16} />
                  Start New Training
                </button>
              </div>
            </div>

            {/* New Training Form */}
            {showTrainingForm && (
              <div className="bg-green-50 p-6 rounded-lg border border-green-200 mb-6">
                <h4 className="font-medium text-green-800 mb-4">Start New Model Training</h4>
                
                {/* File Upload Section */}
                <div className="mb-6">
                  <label className="block text-black font-medium mb-2">Upload Dataset File</label>
                  <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="datasetFile"
                      accept=".csv,.json,.txt,.jsonl"
                      onChange={(e) => handleTrainingFormChange('selectedFile', e.target.files[0])} // ✅ UPDATED
                      className="hidden"
                    />
                    
                    {!trainingForms.selectedFile ? (
                      <label 
                        htmlFor="datasetFile" 
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <IconUpload size={48} className="text-green-400 mb-2" />
                        <p className="text-black font-medium">Click to upload dataset</p>
                        <p className="text-green-600 text-sm mt-1">
                          Supports CSV, JSON, TXT, JSONL files
                        </p>
                      </label>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <IconCheck size={24} className="text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{trainingForms.selectedFile.name}</p>
                          <p className="text-green-600 text-sm">
                            {(trainingForms.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={() => handleTrainingFormChange('selectedFile', null)}
                          className="text-red-600 hover:text-red-800 ml-4"
                        >
                          <IconX size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Model Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-black font-medium mb-2">Model Type</label>
                    <select
                      value={trainingForms.modelType || ''}
                      onChange={(e) => handleTrainingFormChange('modelType', e.target.value)}
                      className="w-full px-3 py-2 border text-black border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Model Type</option>
                      <option value="lora">LoRA Fine-tuning</option>
                      <option value="llama">Llama</option>
                      <option value="blip">BLIP</option>
                    </select>
                  </div>
                  
                  {trainingForms.modelType === 'lora' && ( // ✅ NEW CONDITIONAL FIELD
                    <div>
                      <label className="block text-black font-medium mb-2">Base Model</label>
                      <select
                        value={selectedBaseModel}
                        onChange={(e) => setSelectedBaseModel(e.target.value)}
                        className="w-full px-3 py-2 border text-black border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="llama3">Llama3</option>
                        <option value="llama2">Llama2</option>
                        <option value="codellama">CodeLlama</option>
                        <option value="mistral">Mistral</option>
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-black font-medium mb-2">Epochs</label>
                    <input
                      type="number"
                      value={trainingForms.epochs || ''}
                      onChange={(e) => handleTrainingFormChange('epochs', e.target.value)}
                      placeholder={trainingForms.modelType === 'lora' ? '3' : '3'}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-green-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-black font-medium mb-2">Learning Rate</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={trainingForms.learningRate || ''}
                      onChange={(e) => handleTrainingFormChange('learningRate', e.target.value)}
                      placeholder={trainingForms.modelType === 'lora' ? '0.0002' : '0.001'}
                      className="w-full px-3 py-2 border text-black border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  {/* ✅ NEW: LoRA specific parameters */}
                  {trainingForms.modelType === 'lora' && (
                    <>
                      <div>
                        <label className="block text-black font-medium mb-2">LoRA Rank (r)</label>
                        <input
                          type="number"
                          value={trainingForms.loraRank || ''}
                          onChange={(e) => handleTrainingFormChange('loraRank', e.target.value)}
                          placeholder="16"
                          min="1"
                          max="64"
                          className="w-full px-3 py-2 border border-green-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-black font-medium mb-2">LoRA Alpha</label>
                        <input
                          type="number"
                          value={trainingForms.loraAlpha || ''}
                          onChange={(e) => handleTrainingFormChange('loraAlpha', e.target.value)}
                          placeholder="32"
                          min="1"
                          max="128"
                          className="w-full px-3 py-2 border border-green-300 rounded text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={handleTrainingSubmit}
                    disabled={!trainingForms.modelType || !trainingForms.selectedFile || startingTraining}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2"
                  >
                    {startingTraining ? (
                      <>
                        <IconLoader size={16} className="animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <IconPlus size={16} />
                        Start {trainingForms.modelType === 'lora' ? 'LoRA' : ''} Training
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowTrainingForm(false);
                      setTrainingForms({});
                    }}
                    className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Training Jobs List */}
            {filteredTrainingJobs.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <IconBrain size={64} className="mx-auto text-green-300 mb-4" />
                <p className="text-green-800 text-lg">
                  {statusFilter === 'all' ? "No training jobs found." : `No ${statusFilter} training jobs found.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-green-100">
                {filteredTrainingJobs.map((job, index) => {
                  const isExpanded = expandedTraining === job._id;
                  
                  return (
                    <div key={`job-${job._id}-${job.createdAt}-${index}`} className="py-6 hover:bg-green-25">
                      {/* Job Header */}
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => setExpandedTraining(isExpanded ? null : job._id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-900 text-lg">{job.name || job.modelName}</h4>
                            
                            {/* ✅ NEW: LoRA badge */}
                            {job.modelType === 'lora' && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 border border-purple-300">
                                LoRA
                              </span>
                            )}
                            
                            {/* Status Badge */}
                            <span className={`px-3 py-1 text-sm font-bold rounded-full ${
                              job.status === 'pending' 
                                ? 'bg-amber-500 text-amber-900 border border-amber-600'
                                : job.status === 'running'
                                ? 'bg-blue-500 text-blue-900 border border-blue-600'
                                : job.status === 'completed'
                                ? 'bg-green-500 text-green-900 border border-green-600'
                                : 'bg-red-500 text-red-900 border border-red-600'
                            }`}>
                              {job.status === 'pending' && <IconClock size={14} className="inline mr-1" />}
                              {job.status === 'running' && <IconLoader size={14} className="inline mr-1 animate-spin" />}
                              {job.status === 'completed' && <IconCheck size={14} className="inline mr-1" />}
                              {job.status === 'failed' && <IconX size={14} className="inline mr-1" />}
                              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </span>
                            
                            {job.accuracy && (
                              <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                                Accuracy: {(job.accuracy * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-700 mb-2 font-medium">
                            <span className="flex items-center gap-1">
                              <IconDatabase size={14} />
                              Dataset: {job.dataset?.filename || job.dataset}
                            </span>
                            {job.modelType === 'lora' && job.baseModel && (
                              <span>Base: {job.baseModel}</span>
                            )}
                            <span>
                              Started: {job.createdAt
                                ? new Date(job.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'N/A'}
                            </span>
                          </div>
                          
                          {!isExpanded && job.log && (
                            <p className="text-green-800 text-sm">
                              Latest: {job.log}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {job.status === 'running' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelTraining(job._id);
                              }}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                            >
                              <IconX size={16} />
                            </button>
                          )}
                          
                          <button className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded">
                            {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-6 pt-6 border-t border-green-100 space-y-6">
                          
                          {/* Parameters */}
                          {job.parameters && Object.keys(job.parameters).length > 0 && (
                            <div>
                              <h5 className="font-medium text-green-800 mb-2">Training Parameters:</h5>
                              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  {Object.entries(job.parameters).map(([key, value]) => (
                                    <div key={key}>
                                      <span className="text-green-600 font-medium">{key}:</span>
                                      <span className="text-green-900 ml-2">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Training Log */}
                          {job.log && (
                            <div>
                              <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                                <IconEye size={16} />
                                Training Log:
                              </h5>
                              <div className="bg-gray-900 text-green-400 p-4 rounded-lg border max-h-64 overflow-y-auto font-mono text-sm">
                                {job.log}
                              </div>
                            </div>
                          )}
                          
                          {/* ✅ NEW: Action Buttons for completed LoRA jobs */}
                          <div className="flex gap-4 pt-4 border-t border-green-100">
                            {job.status === 'completed' && job.modelType === 'lora' && job.model_path && (
                              <button
                                onClick={() => handleLoadLoRAAdapter(job.model_path, job.name)}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                              >
                                <IconUpload size={16} />
                                Load LoRA Adapter
                              </button>
                            )}
                            {job.status === 'completed' && (
                              <button
                                onClick={() => {/* Implement export functionality */}}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                              >
                                <IconDownload size={16} />
                                Export Model
                              </button>
                            )}
                            {job.status === 'failed' && (
                              <button
                                onClick={() => {/* Implement restart functionality */}}
                                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 flex items-center gap-2"
                              >
                                <IconRefresh size={16} />
                                Retry Training
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ✅ UPDATED: Models Tab Content */}
        {activeTab === 'models' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-green-800 font-semibold text-lg">LoRA Adapter Management</h3>
              <div className="flex gap-4 items-center">
                <select
                  value={selectedBaseModel}
                  onChange={(e) => setSelectedBaseModel(e.target.value)}
                  className="bg-white border border-green-300 text-green-800 px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="llama3">Llama3 Base</option>
                  <option value="llama2">Llama2 Base</option>
                  <option value="codellama">CodeLlama Base</option>
                  <option value="mistral">Mistral Base</option>
                </select>
                <button
                  onClick={getAvailableAdapters}
                  className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 flex items-center gap-2"
                >
                  <IconRefresh size={16} />
                  Refresh Adapters
                </button>
              </div>
            </div>

            {/* ✅ NEW: Available Adapters List */}
            {availableAdapters.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow text-center mb-6">
                <IconDatabase size={48} className="mx-auto text-green-300 mb-4" />
                <p className="text-green-800 text-lg">No LoRA adapters found on disk.</p>
                <p className="text-green-600 text-sm mt-2">Complete a LoRA training job to create adapters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {availableAdapters.map((adapter, index) => (
                  <div key={`adapter-${adapter.name}-${adapter.created}-${index}`} className="bg-green-50 p-4 rounded-lg border border-green-200 shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-green-900 text-base">{adapter.name}</h4>
                      {adapter.is_loaded && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                          Loaded
                        </span>
                      )}
                    </div>
                    <p className="text-green-600 text-sm">Size: {adapter.size}</p>
                    <p className="text-green-600 text-sm">
                      Created: {new Date(adapter.created).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => handleLoadLoRAAdapter(adapter.path, adapter.name)}
                      disabled={adapter.is_loaded || modelLoading}
                      className="mt-3 w-full bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {modelLoading ? (
                        <>
                          <IconLoader size={16} className="animate-spin" />
                          Loading...
                        </>
                      ) : adapter.is_loaded ? (
                        <>
                          <IconCheck size={16} />
                          Adapter Loaded
                        </>
                      ) : (
                        <>
                          <IconUpload size={16} />
                          Load with {selectedBaseModel}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-between items-center mb-6 border-t pt-6">
              <h3 className="text-green-800 font-semibold text-lg">Currently Loaded Models</h3>
            </div>
            
            {/* Loaded Models List */}
            {loadedModels.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <IconRobot size={64} className="mx-auto text-green-300 mb-4" />
                <p className="text-green-800 text-lg">No models loaded currently.</p>
                <p className="text-green-600 text-sm mt-2">Load a LoRA adapter to see it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadedModels.map((model, index) => {
                  // ✅ FIX: Better model ID detection
                  const modelId = model.id || model.modelId || model.model_id || model.name;
                  const modelType = model.type || 'unknown';
                  const modelName = model.name || modelId || 'Unknown Model';
                  
                  console.log('🔍 [FRONTEND] Model data:', { model, modelId, modelType, modelName });
                  
                  return (
                    <div key={`model-${modelId}-${model.loaded_at || index}`} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-green-900 text-lg flex items-center gap-2">
                            <IconRobot size={20} />
                            {modelName}
                          </h4>
                          <p className="text-green-600 text-sm">
                            {modelType} model 
                            {modelType === 'lora' && model.base_model && ` on ${model.base_model}`}
                          </p>
                          {(model.adapter_size || model.size) && (
                            <p className="text-green-500 text-xs mt-1">
                              Size: {model.adapter_size || model.size}
                            </p>
                          )}
                          {/* ✅ NEW: Show model path for debugging */}
                          {model.adapter_path && (
                            <p className="text-green-400 text-xs mt-1 truncate" title={model.adapter_path}>
                              Path: .../{model.adapter_path.split('/').pop()}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-300">
                          {model.status || 'Active'}
                        </span>
                      </div>
                      
                      {(model.loaded_at || model.load_time) && (
                        <p className="text-green-600 text-sm mb-4">
                          Loaded: {new Date(model.loaded_at || model.load_time).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // ✅ FIX: Validate modelId before calling
                            if (modelId && modelId !== 'undefined') {
                              getModelStatus(modelId);
                            } else {
                              alert('Invalid model ID. Cannot get status.');
                              console.error('❌ Invalid modelId:', { model, modelId });
                            }
                          }}
                          disabled={!modelId || modelId === 'undefined'}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                        >
                          <IconEye size={14} />
                          Status
                        </button>
                        <button
                          onClick={() => {
                            // ✅ FIX: Validate modelId before calling
                            if (modelId && modelId !== 'undefined') {
                              // ✅ Check if model can be unloaded
                              if (model.can_unload === false) {
                                alert(`ℹ️ ${modelName} is a base model and cannot be unloaded.\n\nBase models are always available through Ollama.`);
                                return;
                              }
                              handleUnloadModel(modelId);
                            } else {
                              alert('Invalid model ID. Cannot unload.');
                              console.error('❌ Invalid modelId:', { model, modelId });
                            }
                          }}
                          disabled={!modelId || modelId === 'undefined' || model.can_unload === false}
                          className={`flex-1 px-3 py-2 rounded text-sm flex items-center justify-center gap-2 ${
                            model.can_unload === false 
                              ? 'bg-gray-400 text-white cursor-not-allowed opacity-50' 
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                          title={model.can_unload === false ? 'Base models cannot be unloaded' : 'Unload this model'}
                        >
                          <IconTrash size={14} />
                          {model.can_unload === false ? 'Base Model' : 'Unload'}
                        </button>
                      </div>
                      
                      {/* ✅ NEW: Debug info for development */}
                      {process.env.NODE_ENV === 'development' && (
                        <details className="mt-4 text-xs">
                          <summary className="cursor-pointer text-gray-500">Debug Info</summary>
                          <pre className="bg-gray-100 p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(model, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelManagement;
