// ============================================
// UPLOAD ROUTES
// ============================================

import { Router } from 'express';
import multer from 'multer';
import { uploadImages } from '../controllers/uploadController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 20, // Max 20 files at once
  },
});

// POST /api/upload/images - Upload images
router.post('/images', authenticateToken, upload.array('images', 20), uploadImages);

export default router;
