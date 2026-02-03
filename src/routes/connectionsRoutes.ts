// ============================================
// CONNECTIONS ROUTES
// ============================================

import { Router } from 'express';
import {
  getAllConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  reconnectConnection,
} from '../controllers/connectionsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Alle Routen benötigen Login
router.use(requireAuth);

router.get('/', getAllConnections);              // GET /api/connections
router.post('/', createConnection);              // POST /api/connections
router.put('/:id', updateConnection);            // PUT /api/connections/:id
router.delete('/:id', deleteConnection);         // DELETE /api/connections/:id
router.post('/:id/reconnect', reconnectConnection); // POST /api/connections/:id/reconnect

export default router;
