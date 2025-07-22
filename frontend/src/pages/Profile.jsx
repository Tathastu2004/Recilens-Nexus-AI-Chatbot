import React, { useState } from 'react';
import { IconPencil, IconCheck, IconX } from '@tabler/icons-react';

const Profile = () => {
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: 'https://assets.aceternity.com/manu.png' // Default avatar
  });

  const [isEditing, setIsEditing] = useState({
    name: false,
    email: false
  });

  const [tempValues, setTempValues] = useState({
    name: profile.name,
    email: profile.email
  });

  const handleEdit = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: true }));
    setTempValues(prev => ({ ...prev, [field]: profile[field] }));
  };

  const handleSave = (field) => {
    setProfile(prev => ({ ...prev, [field]: tempValues[field] }));
    setIsEditing(prev => ({ ...prev, [field]: false }));
  };

  const handleCancel = (field) => {
    setIsEditing(prev => ({ ...prev, [field]: false }));
    setTempValues(prev => ({ ...prev, [field]: profile[field] }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, avatarUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-8">Profile Settings</h1>

        {/* Profile Picture */}
        <div className="mb-8 text-center">
          <div className="relative inline-block">
            <img
              src={profile.avatarUrl}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover"
            />
            <label className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer hover:bg-blue-600">
              <IconPencil className="w-4 h-4 text-white" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
            </label>
          </div>
        </div>

        {/* Name Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name
          </label>
          <div className="flex items-center gap-2">
            {isEditing.name ? (
              <>
                <input
                  type="text"
                  value={tempValues.name}
                  onChange={(e) => setTempValues(prev => ({ ...prev, name: e.target.value }))}
                  className="flex-1 p-2 border rounded-md"
                />
                <button
                  onClick={() => handleSave('name')}
                  className="p-2 text-green-600 hover:text-green-700"
                >
                  <IconCheck className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleCancel('name')}
                  className="p-2 text-red-600 hover:text-red-700"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{profile.name}</span>
                <button
                  onClick={() => handleEdit('name')}
                  className="p-2 text-gray-600 hover:text-gray-700"
                >
                  <IconPencil className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Email Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <div className="flex items-center gap-2">
            {isEditing.email ? (
              <>
                <input
                  type="email"
                  value={tempValues.email}
                  onChange={(e) => setTempValues(prev => ({ ...prev, email: e.target.value }))}
                  className="flex-1 p-2 border rounded-md"
                />
                <button
                  onClick={() => handleSave('email')}
                  className="p-2 text-green-600 hover:text-green-700"
                >
                  <IconCheck className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleCancel('email')}
                  className="p-2 text-red-600 hover:text-red-700"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{profile.email}</span>
                <button
                  onClick={() => handleEdit('email')}
                  className="p-2 text-gray-600 hover:text-gray-700"
                >
                  <IconPencil className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;