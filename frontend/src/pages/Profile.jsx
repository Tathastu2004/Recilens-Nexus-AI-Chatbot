import React, { useState, useEffect } from 'react';
import { 
  IconPencil, 
  IconCheck, 
  IconX, 
  IconCamera, 
  IconLogout, 
  IconArrowLeft,
  IconUser,
  IconMail,
  IconShield,
  IconSettings,
  IconSun,
  IconMoon
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useClerkUser } from '../context/ClerkUserContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-react';

// ✅ MINIMAL CONFIRMATION DIALOG
const ConfirmationDialog = ({ isOpen, title, message, onConfirm, onCancel, isDark, confirmText = "Confirm", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      ></div>
      
      <div className="relative w-full max-w-md mx-auto rounded-2xl shadow-xl"
           style={{ 
             backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
             border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
           }}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#000000' }}>
            {title}
          </h3>
          
          <p className="text-sm mb-6"
             style={{ color: isDark ? '#cccccc' : '#666666' }}>
            {message}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#cccccc' : '#666666'
              }}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ 
                backgroundColor: '#ef4444',
                color: '#ffffff'
              }}
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

  useEffect(() => {
    if (user) {
      setTempValues({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  useEffect(() => {
    if (successMessage || Object.keys(errors).length > 0) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrors({});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errors]);

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

  const handleSave = async (field) => {
    setUpdateLoading(true);
    setErrors({});

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
      
      if (response.ok && result.success) {
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

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

      const response = await fetch(`${backendUrl}/api/clerk/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
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

  const handleLogout = () => {
    openConfirmDialog(
      'Sign out',
      'Are you sure you want to sign out?',
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
      'Sign out',
      'Cancel'
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

  // ✅ MINIMAL LOADING STATE
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto"
               style={{ 
                 border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                 borderTopColor: isDark ? '#ffffff' : '#000000'
               }}></div>
          <div className="text-sm"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
            Loading profile...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
        <div className="text-center space-y-6 p-8 rounded-xl max-w-md w-full"
             style={{ 
               backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
               border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
             }}>
          <div className="text-4xl">⚠️</div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold"
                style={{ color: isDark ? '#ffffff' : '#000000' }}>
              Unable to load profile
            </h3>
            <p className="text-sm"
               style={{ color: isDark ? '#cccccc' : '#666666' }}>
              Please try refreshing the page
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 font-medium rounded-lg transition-colors"
            style={{ 
              backgroundColor: isDark ? '#ffffff' : '#000000',
              color: isDark ? '#000000' : '#ffffff'
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen"
           style={{ backgroundColor: isDark ? '#1F1F1F' : '#ffffff' }}>
        
        {/* ✅ MINIMAL HEADER */}
        <div className="border-b"
             style={{ 
               backgroundColor: isDark ? '#1F1F1F' : '#ffffff',
               borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
             }}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                <IconArrowLeft size={16} />
                Back
              </button>

              <h1 className="text-lg font-semibold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Settings
              </h1>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-colors hover:opacity-70"
                style={{ color: isDark ? '#cccccc' : '#666666' }}
              >
                {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* ✅ MAIN CONTENT */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-lg border"
                 style={{ 
                   backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                   borderColor: '#22c55e',
                   color: isDark ? '#ffffff' : '#000000'
                 }}>
              ✅ {successMessage}
            </div>
          )}

          <div className="space-y-8">
            
            {/* ✅ PROFILE SECTION */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Profile
              </h2>
              
              {/* Profile Picture */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <img
                    src={user.profilePicture || 'https://assets.aceternity.com/manu.png'}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                    style={{ 
                      backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                      border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                    }}
                    onError={(e) => {
                      e.target.src = 'https://assets.aceternity.com/manu.png';
                    }}
                  />
                  
                  <label className="absolute -bottom-1 -right-1 p-2 rounded-full cursor-pointer transition-colors"
                         style={{ 
                           backgroundColor: isDark ? '#ffffff' : '#000000',
                           color: isDark ? '#000000' : '#ffffff'
                         }}>
                    {photoLoading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <IconCamera size={14} />
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={photoLoading}
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-medium"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {user.name || 'User'}
                  </h3>
                  <p className="text-sm"
                     style={{ color: isDark ? '#cccccc' : '#666666' }}>
                    {user.email}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${user.isVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span style={{ color: isDark ? '#cccccc' : '#666666' }}>
                      {user.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>
              </div>

              {errors.photo && (
                <div className="p-3 rounded-lg text-sm"
                     style={{ 
                       backgroundColor: 'rgba(239, 68, 68, 0.1)',
                       color: isDark ? '#ffffff' : '#000000'
                     }}>
                  {errors.photo}
                </div>
              )}
            </div>

            {/* ✅ ACCOUNT DETAILS */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Account
              </h2>
              
              {/* Name Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium"
                       style={{ color: isDark ? '#cccccc' : '#666666' }}>
                  Name
                </label>
                
                {isEditing.name ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempValues.name}
                      onChange={(e) => setTempValues(prev => ({ ...prev, name: e.target.value }))}
                      className="flex-1 p-3 rounded-lg border transition-colors"
                      style={{ 
                        backgroundColor: isDark ? '#2D2D2D' : '#ffffff',
                        borderColor: errors.name ? '#ef4444' : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                      placeholder="Enter your name"
                      disabled={updateLoading}
                    />
                    <button
                      onClick={() => handleSave('name')}
                      disabled={updateLoading}
                      className="p-3 rounded-lg transition-colors"
                      style={{ 
                        backgroundColor: '#22c55e',
                        color: '#ffffff'
                      }}
                    >
                      {updateLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <IconCheck size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => handleCancel('name')}
                      disabled={updateLoading}
                      className="p-3 rounded-lg transition-colors"
                      style={{ 
                        backgroundColor: '#ef4444',
                        color: '#ffffff'
                      }}
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 rounded-lg border"
                         style={{ 
                           backgroundColor: isDark ? '#2D2D2D' : '#f8f9fa',
                           borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                           color: isDark ? '#ffffff' : '#000000'
                         }}>
                      {user.name || 'Not set'}
                    </div>
                    <button
                      onClick={() => handleEdit('name')}
                      className="p-3 rounded-lg transition-colors"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        color: isDark ? '#cccccc' : '#666666'
                      }}
                    >
                      <IconPencil size={16} />
                    </button>
                  </div>
                )}
                
                {errors.name && (
                  <div className="text-sm"
                       style={{ color: '#ef4444' }}>
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium"
                       style={{ color: isDark ? '#cccccc' : '#666666' }}>
                  Email
                </label>
                
                <div className="p-3 rounded-lg border"
                     style={{ 
                       backgroundColor: isDark ? '#2D2D2D' : '#f8f9fa',
                       borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                       color: isDark ? '#ffffff' : '#000000'
                     }}>
                  {user.email || 'Not set'}
                </div>
                
                <div className="text-xs"
                     style={{ color: isDark ? '#888888' : '#888888' }}>
                  Managed by your account provider
                </div>
              </div>
            </div>

            {/* ✅ DANGER ZONE */}
            <div className="pt-8 border-t space-y-6"
                 style={{ borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <h2 className="text-xl font-semibold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}>
                Account actions
              </h2>
              
              <button
                onClick={handleLogout}
                disabled={logoutLoading}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}
              >
                {logoutLoading ? (
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <IconLogout size={16} />
                )}
                {logoutLoading ? 'Signing out...' : 'Sign out'}
              </button>
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
