import { Router } from 'express';
import { getUsers, createUser, deleteUser } from '../controllers/userController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getUsers);
router.post('/', createUser);
router.delete('/:id', deleteUser);

export default router;
