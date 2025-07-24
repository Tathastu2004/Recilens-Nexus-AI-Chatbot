import React, { useState, useEffect } from 'react';
import { IconPencil, IconCheck, IconX, IconTrash, IconCamera, IconLogout } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const Profile = () => {
  const { 
    user, 
    loading, 
    updateUserProfile, 
    uploadProfilePhoto, 
    deleteProfilePhoto,
    logoutUser 
  } = useUser();
  
  const navigate = useNavigate();

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

  // Debug logging for user data
  useEffect(() => {
    console.log('🐛 Profile component - user data:', {
      user,
      loading,
      userKeys: user ? Object.keys(user) : 'No user',
      name: user?.name,
      email: user?.email,
      role: user?.role,
      isVerified: user?.isVerified,
      profilePicture: user?.profilePicture
    });
  }, [user, loading]);

  const handleEdit = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: true }));
    setTempValues(prev => ({ ...prev, [field]: user[field] || '' }));
    setErrors({});
  };

  const handleSave = async (field) => {
    setUpdateLoading(true);
    setErrors({});

    // Validation
    if (field === 'name' && !tempValues.name.trim()) {
      setErrors({ name: 'Name is required' });
      setUpdateLoading(false);
      return;
    }

    if (field === 'email' && (!tempValues.email.trim() || !/\S+@\S+\.\S+/.test(tempValues.email))) {
      setErrors({ email: 'Please enter a valid email address' });
      setUpdateLoading(false);
      return;
    }

    try {
      const updateData = {
        [field]: tempValues[field]
      };

      const result = await updateUserProfile(updateData);
      
      if (result.success) {
        setIsEditing(prev => ({ ...prev, [field]: false }));
        setSuccessMessage(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`);
      } else {
        setErrors({ [field]: result.message || `Failed to update ${field}` });
      }
    } catch (error) {
      console.error(`Update ${field} error:`, error);
      setErrors({ [field]: `Failed to update ${field}` });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCancel = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: false }));
    setTempValues(prev => ({ ...prev, [field]: user[field] || '' }));
    setErrors({});
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ photo: 'Please select a valid image file' });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ photo: 'Image size should be less than 5MB' });
      return;
    }

    setPhotoLoading(true);
    setErrors({});

    try {
      const result = await uploadProfilePhoto(file);
      
      if (result.success) {
        setSuccessMessage('Profile photo updated successfully!');
        
        // Force refresh the page to see the new image (temporary solution)
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setErrors({ photo: result.message || 'Failed to upload photo' });
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      setErrors({ photo: 'Failed to upload photo' });
    } finally {
      setPhotoLoading(false);
      // Clear the file input
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm('Are you sure you want to delete your profile photo?')) {
      return;
    }

    setPhotoLoading(true);
    setErrors({});

    try {
      const result = await deleteProfilePhoto();
      
      if (result.success) {
        setSuccessMessage('Profile photo deleted successfully!');
      } else {
        setErrors({ photo: result.message || 'Failed to delete photo' });
      }
    } catch (error) {
      console.error('Photo delete error:', error);
      setErrors({ photo: 'Failed to delete photo' });
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    setLogoutLoading(true);

    try {
      const result = await logoutUser();
      console.log('Logout result:', result);
      
      // Always redirect to signup after logout, regardless of success/failure
      navigate('/signup');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to signup even if there's an error
      navigate('/signup');
    } finally {
      setLogoutLoading(false);
    }
  };

  // Show loading state while user data is being fetched
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show error if no user data
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load profile data</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        {/* Header with Logout Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {logoutLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <IconLogout className="w-4 h-4" />
            )}
            {logoutLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            {successMessage}
          </div>
        )}

        {/* Profile Picture */}
        <div className="mb-8 text-center">
          <div className="relative inline-block">
            <img
              src={
                user.profilePicture 
                  ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}${user.profilePicture}` 
                  : 'https://assets.aceternity.com/manu.png'
              }
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              onError={(e) => {
                console.log('🖼️ Image load error, falling back to default');
                e.target.src = 'https://assets.aceternity.com/manu.png';
              }}
            />
            
            {/* Upload/Camera Button */}
            <label className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer hover:bg-blue-600 shadow-lg">
              {photoLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <IconCamera className="w-4 h-4 text-white" />
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
                disabled={photoLoading}
              />
            </label>

            {/* Delete Photo Button */}
            {user.profilePicture && (
              <button
                onClick={handleDeletePhoto}
                disabled={photoLoading}
                className="absolute top-0 right-0 bg-red-500 p-1 rounded-full hover:bg-red-600 shadow-lg"
                title="Delete photo"
              >
                <IconTrash className="w-3 h-3 text-white" />
              </button>
            )}
          </div>

          {/* Photo Error */}
          {errors.photo && (
            <p className="mt-2 text-sm text-red-600">{errors.photo}</p>
          )}

          <p className="mt-2 text-sm text-gray-500">
            Click camera icon to upload new photo
          </p>
          
          {/* Debug info - remove in production */}
          {user.profilePicture && (
            <p className="mt-1 text-xs text-gray-400">
              Photo URL: {user.profilePicture}
            </p>
          )}
        </div>

        {/* User Role Badge */}
        <div className="mb-6 text-center">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            user.role === 'admin' 
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
          </span>
        </div>

        {/* Name Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <div className="flex items-center gap-2">
            {isEditing.name ? (
              <>
                <input
                  type="text"
                  value={tempValues.name}
                  onChange={(e) => setTempValues(prev => ({ ...prev, name: e.target.value }))}
                  className={`flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                  disabled={updateLoading}
                />
                <button
                  onClick={() => handleSave('name')}
                  disabled={updateLoading}
                  className="p-2 text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  {updateLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                  ) : (
                    <IconCheck className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => handleCancel('name')}
                  disabled={updateLoading}
                  className="p-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-900">{user.name || 'Not set'}</span>
                <button
                  onClick={() => handleEdit('name')}
                  className="p-2 text-gray-600 hover:text-gray-700"
                >
                  <IconPencil className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Email Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="flex items-center gap-2">
            {isEditing.email ? (
              <>
                <input
                  type="email"
                  value={tempValues.email}
                  onChange={(e) => setTempValues(prev => ({ ...prev, email: e.target.value }))}
                  className={`flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email address"
                  disabled={updateLoading}
                />
                <button
                  onClick={() => handleSave('email')}
                  disabled={updateLoading}
                  className="p-2 text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  {updateLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                  ) : (
                    <IconCheck className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => handleCancel('email')}
                  disabled={updateLoading}
                  className="p-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-900">{user.email || 'Not set'}</span>
                <button
                  onClick={() => handleEdit('email')}
                  className="p-2 text-gray-600 hover:text-gray-700"
                >
                  <IconPencil className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Account Info */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account Status:</span>
              <span className={`ml-2 inline-block px-2 py-1 rounded text-xs ${
                user.isVerified 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {user.isVerified ? 'Verified' : 'Pending Verification'}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500">User ID:</span>
              <span className="ml-2 text-gray-900 font-mono text-xs">{user._id || user.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;