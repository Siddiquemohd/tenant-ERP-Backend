import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export interface TenantRequest extends Request {
  tenantId?: string;
}

export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantHeader = req.headers['x-tenant-id'] as string;
    
    if (tenantHeader) {
      req.tenantId = tenantHeader;
      return next();
    }

    // Fallback to query param or first tenant in database
    const tenantQuery = req.query.tenantId as string;
    if (tenantQuery) {
      req.tenantId = tenantQuery;
      return next();
    }

    const firstTenant = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
    if (firstTenant) {
      req.tenantId = firstTenant.id;
    }

    next();
  } catch (error) {
    next(error);
  }
}
