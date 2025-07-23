import express from 'express';
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  logoutUser,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  getUserProfile,
  updateUserProfile
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { uploadProfilePic } from '../middleware/uploadMiddleware.js';
import {
  uploadProfilePhoto,
  getProfilePhoto,
  deleteProfilePhoto
} from '../controllers/userPhotoController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/getprofile', verifyToken, getUserProfile);
router.put('/updateprofile', verifyToken, uploadProfilePic.single('photo'), updateUserProfile);
router.post('/forgot-password', sendPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);




export default router;
