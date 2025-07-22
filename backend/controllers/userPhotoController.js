import fs from 'fs';
import path from 'path';

// 📌 Upload or Update Profile Photo
export const uploadProfilePhoto = async (req, res) => {
  try {
    const user = req.user;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // 🧹 Delete old photo if exists
    if (user.profilePicture) {
      const oldPath = `.${user.profilePicture}`;
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const imagePath = `/uploads/profile/${req.file.filename}`;
    user.profilePicture = imagePath;
    await user.save();

    res.status(200).json({ message: 'Profile picture updated', imageUrl: imagePath });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ message: 'Profile photo upload failed' });
  }
};

// 📌 Get Profile Photo URL
export const getProfilePhoto = async (req, res) => {
  try {
    const user = req.user;
    if (!user.profilePicture) {
      return res.status(404).json({ message: 'No profile photo found' });
    }

    res.status(200).json({ imageUrl: user.profilePicture });
  } catch (err) {
    console.error('Get photo error:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile photo' });
  }
};

// 📌 Delete Profile Photo
export const deleteProfilePhoto = async (req, res) => {
  try {
    const user = req.user;

    if (!user.profilePicture) {
      return res.status(404).json({ message: 'No profile photo to delete' });
    }

    const filePath = `.${user.profilePicture}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    user.profilePicture = '';
    await user.save();

    res.status(200).json({ message: 'Profile photo deleted' });
  } catch (err) {
    console.error('Delete photo error:', err.message);
    res.status(500).json({ message: 'Failed to delete profile photo' });
  }
};
