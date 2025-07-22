import express from 'express';
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  logoutUser,
  sendPasswordResetOtp,
  resetPasswordWithOtp
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/forgot-password', sendPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);

export default router;
