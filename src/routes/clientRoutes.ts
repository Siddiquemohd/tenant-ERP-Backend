import { Router } from 'express';
import { getClients, createClient, deleteClient } from '../controllers/clientController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getClients);
router.post('/', createClient);
router.delete('/:id', deleteClient);

export default router;
