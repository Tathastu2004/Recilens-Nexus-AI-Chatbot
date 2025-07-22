import express from 'express';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';
import { getAllUsers } from './adminController.js';

const router = express.Router();

router.get('/users', verifyToken, requireAdmin, getAllUsers);

export default router;
