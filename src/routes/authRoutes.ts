// ============================================
// AUTH ROUTES
// ============================================

import { Router } from 'express';
import { signup, login, logout, me } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Öffentliche Routen (kein Login nötig)
router.post('/signup', signup);    // POST /api/auth/signup
router.post('/login', login);      // POST /api/auth/login

// Geschützte Routen (Login erforderlich)
router.post('/logout', requireAuth, logout);  // POST /api/auth/logout
router.get('/me', requireAuth, me);           // GET /api/auth/me

export default router;
