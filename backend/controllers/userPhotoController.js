import fs from 'fs';
import path from 'path';

// 📌 Upload or Update Profile Photo
export const uploadProfilePhoto = async (req, res) => {
  console.log('🔶 [PHOTO] Upload profile photo request:', {
    userId: req.user?._id,
    file: req.file ? {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'No file',
    timestamp: new Date().toISOString()
  });

  try {
    const user = req.user;
    console.log('🔍 [PHOTO] Current user data:', {
      id: user?._id,
      email: user?.email,
      currentProfilePicture: user?.profilePicture
    });

    if (!req.file) {
      console.log('❌ [PHOTO] No file uploaded');
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    // 🧹 Delete old photo if exists
    if (user.profilePicture) {
      const oldPath = `.${user.profilePicture}`;
      console.log('🗑️ [PHOTO] Checking for old photo to delete:', oldPath);
      
      if (fs.existsSync(oldPath)) {
        console.log('🗑️ [PHOTO] Deleting old photo:', oldPath);
        fs.unlinkSync(oldPath);
        console.log('✅ [PHOTO] Old photo deleted successfully');
      } else {
        console.log('ℹ️ [PHOTO] Old photo file not found on disk:', oldPath);
      }
    }

    const imagePath = `/uploads/profile/${req.file.filename}`;
    console.log('💾 [PHOTO] Setting new profile picture path:', imagePath);
    
    user.profilePicture = imagePath;
    await user.save();

    console.log('✅ [PHOTO] User profile picture updated in database');

    const responseData = { 
      success: true,
      message: 'Profile picture updated', 
      imageUrl: imagePath,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      }
    };

    console.log('✅ [PHOTO] Sending upload response:', responseData);
    res.status(200).json(responseData);

  } catch (err) {
    console.error('❌ [PHOTO] Upload error:', err.message);
    console.error('❌ [PHOTO] Upload stack:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Profile photo upload failed' 
    });
  }
};

// 📌 Get Profile Photo URL
export const getProfilePhoto = async (req, res) => {
  console.log('🔶 [PHOTO] Get profile photo request:', {
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });

  try {
    const user = req.user;
    console.log('🔍 [PHOTO] User profile picture data:', {
      id: user?._id,
      email: user?.email,
      profilePicture: user?.profilePicture,
      hasProfilePicture: !!user?.profilePicture
    });

    if (!user.profilePicture) {
      console.log('ℹ️ [PHOTO] No profile photo found for user');
      return res.status(404).json({ 
        success: false,
        message: 'No profile photo found' 
      });
    }

    // Check if file exists on disk
    const filePath = `.${user.profilePicture}`;
    console.log('🔍 [PHOTO] Checking if file exists:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ [PHOTO] Profile picture file not found on disk:', filePath);
      // Optionally clear the database reference
      user.profilePicture = '';
      await user.save();
      console.log('🧹 [PHOTO] Cleared invalid profile picture reference from database');
      
      return res.status(404).json({ 
        success: false,
        message: 'Profile photo file not found' 
      });
    }

    const responseData = { 
      success: true,
      imageUrl: user.profilePicture 
    };

    console.log('✅ [PHOTO] Sending get photo response:', responseData);
    res.status(200).json(responseData);

  } catch (err) {
    console.error('❌ [PHOTO] Get photo error:', err.message);
    console.error('❌ [PHOTO] Get photo stack:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch profile photo' 
    });
  }
};

// 📌 Delete Profile Photo
export const deleteProfilePhoto = async (req, res) => {
  console.log('🔶 [PHOTO] Delete profile photo request:', {
    userId: req.user?._id,
    timestamp: new Date().toISOString()
  });

  try {
    const user = req.user;
    console.log('🔍 [PHOTO] User data for deletion:', {
      id: user?._id,
      email: user?.email,
      currentProfilePicture: user?.profilePicture
    });

    if (!user.profilePicture) {
      console.log('ℹ️ [PHOTO] No profile photo to delete');
      return res.status(404).json({ 
        success: false,
        message: 'No profile photo to delete' 
      });
    }

    const filePath = `.${user.profilePicture}`;
    console.log('🗑️ [PHOTO] Attempting to delete file:', filePath);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ [PHOTO] Profile photo file deleted from disk');
    } else {
      console.log('⚠️ [PHOTO] Profile photo file not found on disk:', filePath);
    }

    user.profilePicture = '';
    await user.save();
    console.log('✅ [PHOTO] Profile picture reference cleared from database');

    const responseData = { 
      success: true,
      message: 'Profile photo deleted',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture
      }
    };

    console.log('✅ [PHOTO] Sending delete response:', responseData);
    res.status(200).json(responseData);

  } catch (err) {
    console.error('❌ [PHOTO] Delete photo error:', err.message);
    console.error('❌ [PHOTO] Delete photo stack:', err.stack);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete profile photo' 
    });
  }
};
