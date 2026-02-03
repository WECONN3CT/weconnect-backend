// ============================================
// ANALYTICS ROUTES
// ============================================

import { Router } from 'express';
import { getDashboard, getPostAnalytics } from '../controllers/analyticsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Alle Routen benötigen Login
router.use(requireAuth);

router.get('/dashboard', getDashboard);       // GET /api/analytics/dashboard
router.get('/posts/:id', getPostAnalytics);   // GET /api/analytics/posts/:id

export default router;
