import { Router } from 'express';
import {
  getPurchaseOrders,
  getPOById,
  createPurchaseOrder,
  updatePOStatus,
  deletePurchaseOrder,
} from '../controllers/purchaseOrderController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getPurchaseOrders);
router.get('/:id', getPOById);
router.post('/', createPurchaseOrder);
router.patch('/:id/status', updatePOStatus);
router.delete('/:id', deletePurchaseOrder);

export default router;
