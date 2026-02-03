// ============================================
// POSTS ROUTES
// ============================================

import { Router } from 'express';
import {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  publishPost,
} from '../controllers/postsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Alle Routen benötigen Login
router.use(requireAuth);

router.get('/', getAllPosts);           // GET /api/posts
router.get('/:id', getPostById);        // GET /api/posts/:id
router.post('/', createPost);           // POST /api/posts
router.put('/:id', updatePost);         // PUT /api/posts/:id
router.delete('/:id', deletePost);      // DELETE /api/posts/:id
router.post('/:id/publish', publishPost); // POST /api/posts/:id/publish

export default router;
