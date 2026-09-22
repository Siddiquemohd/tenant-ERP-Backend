import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from '../controllers/invoiceController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.patch('/:id/status', updateInvoiceStatus);
router.delete('/:id', deleteInvoice);

export default router;
