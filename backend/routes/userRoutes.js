import express from 'express';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';
import { uploadProfilePic } from '../middleware/uploadMiddleware.js';
import {
  uploadProfilePhoto,
  getProfilePhoto,
  deleteProfilePhoto
} from '../controllers/userPhotoController.js';

const router = express.Router();

// 🔼 Upload or update profile photo (form-data: photo)
router.post('/profile/photo', verifyToken, uploadProfilePic.single('photo'), uploadProfilePhoto);

// 📤 Get current profile photo URL
router.get('/profile/photo', verifyToken, getProfilePhoto);

// ❌ Delete current profile photo
router.delete('/profile/photo', verifyToken, deleteProfilePhoto);

export default router;
