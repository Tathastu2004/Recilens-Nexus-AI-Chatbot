import express from 'express';
import {
  syncClerkUser,
  getUserProfile,
  updateUserProfile
} from '../controllers/authController.js';
import { verifyToken, attachUserMiddleware } from '../middleware/authMiddleware.js';
import { uploadProfilePic } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ✅ WEBHOOK ENDPOINT (NO AUTH REQUIRED)
router.post('/webhooks/sync-user', syncClerkUser);

// ✅ PROTECTED ROUTES (REQUIRE CLERK AUTH + USER DATA)
router.get('/getprofile', verifyToken, attachUserMiddleware, getUserProfile);
router.put('/updateprofile', verifyToken, attachUserMiddleware, uploadProfilePic.single('photo'), updateUserProfile);

// ✅ TEST ROUTES
router.get('/test-auth', verifyToken, attachUserMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Clerk authentication successful',
    user: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      clerkId: req.user.clerkUserId,
      migrated: req.user.migratedToClerk
    },
    clerk: {
      userId: req.auth.userId,
      sessionId: req.auth.sessionId
    }
  });
});

router.get('/test-webhook', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

export default router;
