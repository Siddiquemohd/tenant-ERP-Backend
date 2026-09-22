import { Router } from 'express';
import { getTenants, getActiveTenant, createTenant, updateTenantProfile } from '../controllers/tenantController';

const router = Router();

router.get('/all', getTenants);
router.get('/active', getActiveTenant);
router.post('/create', createTenant);
router.put('/update', updateTenantProfile);

export default router;
