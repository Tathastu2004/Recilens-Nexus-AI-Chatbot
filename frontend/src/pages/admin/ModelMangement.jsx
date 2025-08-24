import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  IconBrain, IconCheck, IconClock, IconLoader, 
  IconSettings, IconX,  IconRefresh, IconAlertCircle,
  IconChevronDown, IconChevronUp, IconDownload, IconTrash, IconPlus,
  IconDatabase, IconRobot, IconEye, IconUpload
} from '@tabler/icons-react';
import { useModelManagement } from '../../context/ModelContext';
import { useUser } from '../../context/UserContext';

const ModelManagement = () => {
  const { user } = useUser();
  const { 
    trainingJobs,
    loadedModels,
    modelStatus,
    trainingLoading,
    modelLoading,
    error,
    notifications,
    startModelTraining,
    getTrainingJobs,
    cancelTraining,
    loadModel,
    unloadModel,
    getLoadedModels,
    getModelStatus,
    clearError,
    removeNotification
  } = useModelManagement();

  // Use Vite env for backend URL
  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  const getAuthToken = () => localStorage.getItem('token');

  const apiClient = axios.create({
    baseURL: `${API_BASE}/api/admin`,
    headers: { 'Content-Type': 'application/json' }
  });

  apiClient.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

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

  const prevCompletedCount = useRef(0);

  // Load data on mount
  const fetchData = () => {
    getTrainingJobs();
    getLoadedModels();
  };

  useEffect(() => {
    fetchData();
  }, []);

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
  }, [trainingJobs]);

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

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleTrainingFormChange('selectedFile', file);
      uploadDatasetFile(file);
    }
  };

  // Upload file to server
  const uploadDatasetFile = async (file) => {
    const formData = new FormData();
    formData.append('dataset', file);

    handleTrainingFormChange('uploading', true);
    handleTrainingFormChange('uploadProgress', 0);

    try {
      const response = await apiClient.post('/datasets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          handleTrainingFormChange('uploadProgress', progress);
        }
      });

      console.log('Upload response:', response.data); // ← ADD THIS DEBUG LINE

      if (response.data && response.data.filePath) {
        handleTrainingFormChange('uploadedFilePath', response.data.filePath);
        setSuccessMessage(`Dataset "${file.name}" uploaded successfully!`);
      } else {
        console.log('No filePath in response:', response.data); // ← ADD THIS TOO
      }
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      handleTrainingFormChange('uploading', false);
    }
  };

  // Submit new training
  const handleTrainingSubmit = async () => {
    const { modelName, uploadedFilePath } = trainingForms;

    if (!modelName) {
      alert("Please select a model to train.");
      return;
    }
    if (!uploadedFilePath) {
      alert("Please upload a dataset file first.");
      return;
    }

    try {
      setTraining({ ...training, training: true });
      await apiClient.post('/model/training/start', {
        modelName,
        dataset: uploadedFilePath,
        parameters: {} // Add more parameters as needed
      });
      alert("Training started successfully.");
      setTrainingForms({});
      setShowTrainingForm(false);
      fetchData();
    } catch (error) {
      console.error("Training start failed:", error);
      alert("Training start failed. Check console or backend logs.");
    } finally {
      setTraining({ ...training, training: false });
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
      if (result) {
        setSuccessMessage(`Model ${modelId} loaded successfully!`);
        setLoadingForms({});
        setShowLoadingForm(false);
        fetchData();
      }
    } catch (error) {
      console.error('Model load error:', error);
    }
  };

  // Cancel training
  const handleCancelTraining = async (jobId) => {
    try {
      const result = await cancelTraining(jobId);
      if (result) {
        setSuccessMessage('Training job cancelled successfully!');
        fetchData();
      }
    } catch (error) {
      console.error('Cancel training error:', error);
    }
  };

  // Unload model
  const handleUnloadModel = async (modelId) => {
    try {
      const result = await unloadModel(modelId);
      if (result) {
        setSuccessMessage(`Model ${modelId} unloaded successfully!`);
        fetchData();
      }
    } catch (error) {
      console.error('Unload model error:', error);
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

  // Good: logic inside a function
  const fetchLoadedModels = async () => {
    const res = await apiClient.get('/model/loaded');
    dispatch({ type: actionTypes.SET_LOADED_MODELS, payload: res.data.loadedModels || [] });
  };

  // Good: JSX is clean, no logic inside
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
      {notifications.map(notification => (
        <div
          key={notification.id}
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
           {/* <IconPlay size={16} />  */}
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
            Loaded Models ({loadedModels.length})
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
                      onChange={handleFileChange}
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
                  
                  {/* Upload Progress */}
                  {trainingForms.uploading && (
                    <div className="mt-4">
                      <div className="bg-green-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${trainingForms.uploadProgress || 0}%` }}
                        />
                      </div>
                      <p className="text-black text-sm mt-2 text-center">
                        Uploading... {trainingForms.uploadProgress || 0}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Model Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-black font-medium mb-2">Model Name</label>
                    <select
                      value={trainingForms.modelName || ''}
                      onChange={(e) => handleTrainingFormChange('modelName', e.target.value)}
                      className="w-full px-3 py-2 border text-black border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Model Type</option>
                      <option value="llama3">Llama 3</option>
                      <option value="blip">BLIP</option>
                      <option value="llama-custom">Custom Llama</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-black font-medium mb-2">Epochs</label>
                    <input
                      type="number"
                      value={trainingForms.epochs || ''}
                      onChange={(e) => handleTrainingFormChange('epochs', e.target.value)}
                      placeholder="3"
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
                      placeholder="0.001"
                      className="w-full px-3 py-2 border text-black border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                  <div className="flex gap-4">
                    <button
                      onClick={handleTrainingSubmit}
                      // disabled={!trainingForms.modelName || !trainingForms.uploadedFilePath || training.training}
                      className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    >
                      {training.training ? "Starting..." : "Start Training"}
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
                {filteredTrainingJobs.map((job) => {
                  const isExpanded = expandedTraining === job._id;
                  
                  return (
                    <div key={job._id} className="py-6 hover:bg-green-25">
                      {/* Job Header */}
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => setExpandedTraining(isExpanded ? null : job._id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-gray-900 text-lg">{job.modelName}</h4>
                            
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
                              Dataset: {job.dataset}
                            </span>
                            <span>
                              Started: {job.startedAt
                                ? new Date(job.startedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'N/A'}
                            </span>
                          </div>
                          
                          {!isExpanded && job.logs && job.logs.length > 0 && (
                            <p className="text-green-800 text-sm">
                              Latest: {job.logs[job.logs.length - 1]}
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
                              {/* <IconStop size={16} /> */}
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

                          {/* Training Logs */}
                          {job.logs && job.logs.length > 0 && (
                            <div>
                              <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                                <IconEye size={16} />
                                Training Logs:
                              </h5>
                              <div className="bg-gray-900 text-green-400 p-4 rounded-lg border max-h-64 overflow-y-auto font-mono text-sm">
                                {job.logs.map((log, index) => (
                                  <div key={index} className="mb-1">
                                    <span className="text-green-500 mr-2">[{index + 1}]</span>
                                    {log}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-4 pt-4 border-t border-green-100">
                            {job.status === 'completed' && (
                              <button
                                onClick={() => {/* Implement export functionality */}}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                              >
                                <IconDownload size={16} />
                                Export Logs
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

        {/* Models Tab Content */}
        {activeTab === 'models' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-green-800 font-semibold text-lg">Model Management</h3>
              <button
                onClick={() => setShowLoadingForm(!showLoadingForm)}
                className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 flex items-center gap-2"
              >
                <IconUpload size={16} />
                Load New Model
              </button>
            </div>

            {/* Model Loading Form */}
            {showLoadingForm && (
              <div className="bg-green-50 p-6 rounded-lg border border-green-200 mb-6">
                <h4 className="font-medium text-green-800 mb-4">Load New Model</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-black font-medium mb-2">Model ID</label>
                    <input
                      type="text"
                      value={loadingForms.modelId || ''}
                      onChange={(e) => handleLoadingFormChange('modelId', e.target.value)}
                      placeholder="e.g., llama3, blip-base"
                      className="w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-black font-medium mb-2">Model Path</label>
                    <input
                      type="text"
                      value={loadingForms.modelPath || ''}
                      onChange={(e) => handleLoadingFormChange('modelPath', e.target.value)}
                      placeholder="./models/llama3"
                      className="w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-black font-medium mb-2">Model Type</label>
                    <select
                      value={loadingForms.modelType || ''}
                      onChange={(e) => handleLoadingFormChange('modelType', e.target.value)}
                      className="w-full px-3 py-2 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select Type</option>
                      <option value="llama">Llama</option>
                      <option value="blip">BLIP</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleModelLoad}
                    disabled={!loadingForms.modelId || !loadingForms.modelPath || !loadingForms.modelType || modelLoading}
                    className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {modelLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Loading Model...
                      </>
                    ) : (
                      <>
                        <IconUpload size={16} />
                        Load Model
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowLoadingForm(false)}
                    className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Loaded Models List */}
            {loadedModels.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <IconRobot size={64} className="mx-auto text-green-300 mb-4" />
                <p className="text-green-800 text-lg">No models loaded currently.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(loadedModels) && loadedModels.map(model => (
                  <div key={model.modelId} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-green-900 text-lg flex items-center gap-2">
                          <IconRobot size={20} />
                          {model.modelId}
                        </h4>
                        <p className="text-green-600 text-sm">{model.type} model</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-300">
                        Loaded
                      </span>
                    </div>
                    
                    {model.loadTime && (
                      <p className="text-green-600 text-sm mb-4">
                        Loaded: {new Date(model.loadTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => getModelStatus(model.modelId)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
                      >
                        <IconEye size={14} />
                        Check Status
                      </button>
                                          <button
                        onClick={() => handleUnloadModel(model.modelId)}
                        className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm flex items-center justify-center gap-2"
                      >
                        <IconTrash size={14} />
                        Unload
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelManagement;
