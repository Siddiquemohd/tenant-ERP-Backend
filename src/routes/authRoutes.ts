import { Router } from 'express';
import {
  login,
  verify2FALogin,
  register,
  getMe,
  setup2FA,
  enable2FA,
  disable2FA,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.post('/verify-2fa', verify2FALogin);
router.post('/register', register);
router.get('/me', authMiddleware as any, getMe);
router.get('/2fa/setup', authMiddleware as any, setup2FA);
router.post('/2fa/enable', authMiddleware as any, enable2FA);
router.post('/2fa/disable', authMiddleware as any, disable2FA);

export default router;
