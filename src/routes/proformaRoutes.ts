import { Router } from 'express';
import {
  getProformaInvoices,
  getProformaById,
  createProformaInvoice,
  convertProformaToInvoice,
  deleteProforma,
} from '../controllers/proformaController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', getProformaInvoices);
router.get('/:id', getProformaById);
router.post('/', createProformaInvoice);
router.post('/:id/convert-invoice', convertProformaToInvoice);
router.delete('/:id', deleteProforma);

export default router;
