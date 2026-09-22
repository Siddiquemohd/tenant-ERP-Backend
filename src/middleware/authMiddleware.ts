import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/userModel';

export interface AuthRequest extends Request {
  user?: any;
  tenantId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'tenant_erp_super_secret_jwt_key_2026';

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.userId) {
        const user = await UserModel.findById(decoded.userId);
        if (user) {
          req.user = user;
          req.tenantId = user.companyId;
          return next();
        }
      }
    }

    // Fallback to Header x-tenant-id or Query param if unauthenticated
    const headerTenant = req.headers['x-tenant-id'] as string;
    if (headerTenant) {
      req.tenantId = headerTenant;
      return next();
    }

    next();
  } catch (err) {
    // If token is invalid or expired, continue with header fallback or return 401 if strict
    const headerTenant = req.headers['x-tenant-id'] as string;
    if (headerTenant) {
      req.tenantId = headerTenant;
      return next();
    }
    next();
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.tenantId) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}
