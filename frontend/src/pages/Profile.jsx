import React, { useState, useEffect } from 'react';
import { 
  IconPencil, 
  IconCheck, 
  IconX, 
  IconTrash, 
  IconCamera, 
  IconLogout, 
  IconArrowLeft,
  IconUser,
  IconMail,
  IconShield,
  IconSettings
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useClerkUser } from '../context/ClerkUserContext'; // ✅ Use Clerk context
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-react';

// ✅ CUSTOM CONFIRMATION DIALOG COMPONENT (same as before)
const ConfirmationDialog = ({ isOpen, title, message, onConfirm, onCancel, isDark, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      ></div>
      
      <div className={`relative w-full max-w-md mx-auto rounded-2xl border shadow-2xl transition-all transform scale-100 ${
        isDark 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className={`flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full ${
            isDark ? 'bg-red-900/30' : 'bg-red-100'
          }`}>
            <IconX size={28} className={isDark ? 'text-red-400' : 'text-red-600'} />
          </div>
          
          <h3 className={`text-lg font-semibold text-center mb-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </h3>
          
          <p className={`text-sm text-center mb-6 leading-relaxed ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {message}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isDark 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const { clerkUser, dbUser, loading, updateDbUser } = useClerkUser();
  const { signOut, getToken } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // ✅ USE CLERK USER DATA
  const user = dbUser || {
    _id: clerkUser?.id,
    name: `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() || clerkUser?.username || 'User',
    email: clerkUser?.primaryEmailAddress?.emailAddress,
    profilePicture: clerkUser?.imageUrl,
    role: 'client',
    isVerified: clerkUser?.emailAddresses?.[0]?.verification?.status === 'verified'
  };

  const [isEditing, setIsEditing] = useState({
    name: false,
    email: false
  });

  const [tempValues, setTempValues] = useState({
    name: '',
    email: ''
  });

  const [photoLoading, setPhotoLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // Initialize temp values when user data loads
  useEffect(() => {
    if (user) {
      setTempValues({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage || Object.keys(errors).length > 0) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrors({});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errors]);

  // ✅ CONFIRMATION DIALOG HANDLERS
  const openConfirmDialog = (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: null,
      confirmText: 'Confirm',
      cancelText: 'Cancel'
    });
  };

  const handleConfirmAction = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirmDialog();
  };

  // ✅ FIXED UPDATE PROFILE FUNCTION
  const handleSave = async (field) => {
    setUpdateLoading(true);
    setErrors({});

    // Validation
    if (field === 'name' && !tempValues.name.trim()) {
      setErrors({ name: 'Name is required' });
      setUpdateLoading(false);
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      console.log('🔄 [PROFILE] Updating profile:', {
        field,
        value: tempValues[field],
        token: token ? 'Present' : 'Missing'
      });

      // ✅ USE CLERK ENDPOINT
      const response = await fetch(`${backendUrl}/api/clerk/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [field]: tempValues[field]
        })
      });

      const result = await response.json();
      
      console.log('📥 [PROFILE] Update response:', {
        status: response.status,
        success: result.success,
        message: result.message
      });
      
      if (response.ok && result.success) {
        // Update local user data
        if (result.user) {
          updateDbUser(result.user);
        }
        
        setIsEditing(prev => ({ ...prev, [field]: false }));
        setSuccessMessage(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
      } else {
        setErrors({ [field]: result.message || `Failed to update ${field}` });
      }
    } catch (error) {
      console.error(`❌ [PROFILE] Update ${field} error:`, error);
      setErrors({ [field]: error.message || `Failed to update ${field}` });
    } finally {
      setUpdateLoading(false);
    }
  };

  // ✅ FIXED PHOTO UPLOAD FUNCTION
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setErrors({ photo: 'Please select a valid image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors({ photo: 'Image size should be less than 5MB' });
      return;
    }

    setPhotoLoading(true);
    setErrors({});

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const formData = new FormData();
      formData.append('photo', file);

      console.log('📸 [PROFILE] Uploading photo...');

      // ✅ USE CLERK ENDPOINT WITH MULTIPART DATA
      const response = await fetch(`${backendUrl}/api/clerk/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type for FormData - let browser set it
        },
        body: formData
      });

      const result = await response.json();
      
      console.log('📥 [PROFILE] Photo upload response:', {
        status: response.status,
        success: result.success,
        message: result.message
      });
      
      if (response.ok && result.success) {
        // Update local user data
        if (result.user) {
          updateDbUser(result.user);
        }
        
        setSuccessMessage('Profile photo updated successfully!');
      } else {
        setErrors({ photo: result.message || 'Failed to upload photo' });
      }
    } catch (error) {
      console.error('❌ [PROFILE] Photo upload error:', error);
      setErrors({ photo: error.message || 'Failed to upload photo' });
    } finally {
      setPhotoLoading(false);
      e.target.value = '';
    }
  };

  // ✅ CLERK LOGOUT HANDLER
  const handleLogout = () => {
    openConfirmDialog(
      'Confirm Logout',
      'Are you sure you want to logout? You will need to sign in again to access your account.',
      async () => {
        setLogoutLoading(true);
        try {
          await signOut();
          navigate('/signin');
        } catch (error) {
          console.error('Logout error:', error);
          navigate('/signin');
        } finally {
          setLogoutLoading(false);
        }
      },
      'Logout',
      'Stay Logged In'
    );
  };

  const handleEdit = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: true }));
    setTempValues(prev => ({ ...prev, [field]: user[field] || '' }));
    setErrors({});
  };

  const handleCancel = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: false }));
    setTempValues(prev => ({ ...prev, [field]: user[field] || '' }));
    setErrors({});
  };

  const handleBackToChat = () => {
    navigate('/chat');
  };

  // ✅ LOADING STATE
  if (loading && !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-all duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
          : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
      }`}>
        <div className="text-center space-y-6">
          <div className="relative">
            <div className={`w-16 h-16 rounded-full border-4 border-t-4 animate-spin mx-auto ${
              isDark 
                ? 'border-gray-700 border-t-blue-400' 
                : 'border-gray-200 border-t-blue-500'
            }`}></div>
          </div>
          
          <div className="space-y-2">
            <div className={`text-xl font-semibold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Loading Profile
            </div>
            <div className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Fetching your account details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if no user data
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`text-center space-y-6 p-8 rounded-2xl border ${
          isDark 
            ? 'bg-gray-800 border-gray-700 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className="text-6xl">⚠️</div>
          
          <div className="space-y-3">
            <div className="text-xl font-bold">
              Profile Load Error
            </div>
            <div className={`max-w-md mx-auto leading-relaxed ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Failed to load your profile data. Please try again.
            </div>
          </div>
          
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`min-h-screen transition-all duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
          : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-50 backdrop-blur-sm border-b transition-all ${
          isDark 
            ? 'bg-gray-900/80 border-gray-700/50' 
            : 'bg-white/80 border-gray-200/50'
        }`}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToChat}
                className={`group flex items-center gap-3 px-4 py-2 rounded-xl transition-all hover:scale-105 ${
                  isDark 
                    ? 'text-gray-300 hover:text-white hover:bg-gray-800' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <IconArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
                <span className="font-medium">Back to Chat</span>
              </button>

              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                }`}>
                  <IconSettings size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <h1 className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  Profile Settings
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl transition-all hover:scale-105 ${
                    isDark 
                      ? 'text-yellow-400 hover:bg-gray-800' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {isDark ? '☀️' : '🌙'}
                </button>

                <button
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {logoutLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <IconLogout size={16} />
                  )}
                  <span className="font-medium hidden sm:block">
                    {logoutLoading ? 'Logging out...' : 'Logout'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Success Message */}
          {successMessage && (
            <div className={`mb-8 p-4 rounded-2xl border-l-4 ${
              isDark 
                ? 'bg-green-900/20 border-green-400 text-green-300' 
                : 'bg-green-50 border-green-400 text-green-700'
            }`}>
              <div className="flex items-center gap-3">
                <IconCheck size={20} />
                <span className="font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Profile Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Profile Picture Card */}
            <div className={`lg:col-span-1 p-8 rounded-3xl border transition-all ${
              isDark 
                ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
                : 'bg-white/70 border-gray-200/50 backdrop-blur-sm'
            } shadow-xl hover:shadow-2xl`}>
              <div className="text-center space-y-6">
                <div className="relative inline-block">
                  <div className={`relative p-1 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 ${
                    photoLoading ? 'animate-pulse' : ''
                  }`}>
                    <img
                      src={user.profilePicture || 'https://assets.aceternity.com/manu.png'}
                      alt="Profile"
                      className={`w-32 h-32 rounded-full object-cover ${
                        isDark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}
                      onError={(e) => {
                        e.target.src = 'https://assets.aceternity.com/manu.png';
                      }}
                    />
                  </div>
                  
                  <label className={`absolute bottom-2 right-2 p-3 rounded-full cursor-pointer shadow-lg transition-all hover:scale-110 ${
                    isDark 
                      ? 'bg-blue-600 hover:bg-blue-500' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}>
                    {photoLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <IconCamera size={20} className="text-white" />
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={photoLoading}
                    />
                  </label>

                  {/* ✅ STATUS INDICATOR */}
                  <div className={`absolute bottom-2 left-2 w-6 h-6 rounded-full border-4 ${
                    isDark ? 'border-gray-800' : 'border-white'
                  } ${
                    user.isVerified ? 'bg-green-500' : 'bg-yellow-500'
                  } shadow-lg`}></div>
                </div>

                <div className="space-y-3">
                  <h2 className={`text-2xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {user.name || 'User Name'}
                  </h2>
                  
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    user.role === 'admin' 
                      ? isDark 
                        ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' 
                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                      : isDark 
                        ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' 
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    <IconShield size={16} />
                    {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                  </div>
                </div>

                {errors.photo && (
                  <div className={`p-3 rounded-xl text-sm ${
                    isDark 
                      ? 'bg-red-900/20 text-red-400 border border-red-500/30' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {errors.photo}
                  </div>
                )}

                <div className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Click the camera icon to upload a new photo
                </div>
              </div>
            </div>

            {/* Profile Details Card */}
            <div className={`lg:col-span-2 p-8 rounded-3xl border transition-all ${
              isDark 
                ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm' 
                : 'bg-white/70 border-gray-200/50 backdrop-blur-sm'
            } shadow-xl hover:shadow-2xl`}>
              
              <div className="space-y-8">
                <div className="flex items-center gap-3 pb-6 border-b border-gray-200/20">
                  <div className={`p-2 rounded-xl ${
                    isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                  }`}>
                    <IconUser size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                  </div>
                  <h3 className={`text-xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    Personal Information
                  </h3>
                </div>

                {/* Name Field */}
                <div className="space-y-3">
                  <label className={`flex items-center gap-2 text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <IconUser size={16} />
                    Full Name
                  </label>
                  
                  <div className="flex items-center gap-3">
                    {isEditing.name ? (
                      <>
                        <input
                          type="text"
                          value={tempValues.name}
                          onChange={(e) => setTempValues(prev => ({ ...prev, name: e.target.value }))}
                          className={`flex-1 p-4 border rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            errors.name 
                              ? 'border-red-300' 
                              : isDark 
                                ? 'border-gray-600 bg-gray-700 text-white' 
                                : 'border-gray-300 bg-white'
                          }`}
                          placeholder="Enter your full name"
                          disabled={updateLoading}
                        />
                        <button
                          onClick={() => handleSave('name')}
                          disabled={updateLoading}
                          className="p-4 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-2xl transition-all disabled:opacity-50"
                        >
                          {updateLoading ? (
                            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <IconCheck size={20} />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancel('name')}
                          disabled={updateLoading}
                          className="p-4 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <IconX size={20} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className={`flex-1 p-4 rounded-2xl border ${
                          isDark 
                            ? 'border-gray-600 bg-gray-700/50 text-white' 
                            : 'border-gray-200 bg-gray-50 text-gray-900'
                        }`}>
                          {user.name || 'Not set'}
                        </div>
                        <button
                          onClick={() => handleEdit('name')}
                          className={`p-4 rounded-2xl transition-all hover:scale-105 ${
                            isDark 
                              ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          <IconPencil size={20} />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {errors.name && (
                    <div className={`p-3 rounded-xl text-sm ${
                      isDark 
                        ? 'bg-red-900/20 text-red-400' 
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {errors.name}
                    </div>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-3">
                  <label className={`flex items-center gap-2 text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <IconMail size={16} />
                    Email Address
                  </label>
                  
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 p-4 rounded-2xl border ${
                      isDark 
                        ? 'border-gray-600 bg-gray-700/50 text-white' 
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}>
                      {user.email || 'Not set'}
                    </div>
                    <div className={`p-4 rounded-2xl ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      <IconMail size={20} />
                    </div>
                  </div>
                  
                  <div className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Email is managed by your Clerk account
                  </div>
                </div>

                {/* Account Info Section */}
                <div className="pt-6 border-t border-gray-200/20">
                  <h4 className={`text-lg font-semibold mb-6 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    Account Information
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className={`p-4 rounded-2xl border ${
                      isDark 
                        ? 'border-gray-600 bg-gray-700/30' 
                        : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Account Status
                      </div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                        user.isVerified 
                          ? isDark 
                            ? 'bg-green-900/30 text-green-400' 
                            : 'bg-green-100 text-green-800'
                          : isDark 
                            ? 'bg-yellow-900/30 text-yellow-400' 
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.isVerified ? '✅' : '⏳'}
                        {user.isVerified ? 'Verified' : 'Pending'}
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-2xl border ${
                      isDark 
                        ? 'border-gray-600 bg-gray-700/30' 
                        : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        User ID
                      </div>
                      <div className={`text-xs font-mono truncate ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {user._id || user.id}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirmDialog}
        isDark={isDark}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />
    </>
  );
};

export default Profile;
