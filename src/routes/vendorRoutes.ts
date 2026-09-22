import { Router } from 'express';
import { getVendors, createVendor, deleteVendor } from '../controllers/vendorController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getVendors);
router.post('/', createVendor);
router.delete('/:id', deleteVendor);

export default router;
