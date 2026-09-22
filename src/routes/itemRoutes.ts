import { Router } from 'express';
import { getItems, createItem, deleteItem } from '../controllers/itemController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getItems);
router.post('/', createItem);
router.delete('/:id', deleteItem);

export default router;
