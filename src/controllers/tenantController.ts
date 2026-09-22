import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { CompanyModel } from '../models/companyModel';
import { UserModel } from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getTenants(req: Request, res: Response) {
  try {
    const tenants = await CompanyModel.findMany();
    res.json(tenants);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getActiveTenant(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(404).json({ error: 'No tenant context found' });
    }
    const tenant = await CompanyModel.findById(tenantId);
    res.json(tenant);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createTenant(req: AuthRequest, res: Response) {
  try {
    const { name, currency, adminName, adminEmail, password } = req.body;
    if (!name) return res.status(400).json({ error: 'Company Name is required' });

    // Determine target admin email and name
    const email = adminEmail || req.user?.email;
    const adminUser = adminName || req.user?.name || 'Tenant Admin';
    const pwd = password || 'admin123';

    if (!email) {
      return res.status(400).json({ error: 'Admin email is required to create a tenant user' });
    }

    // 1. Check if user already exists
    const existing = await UserModel.findByEmail(email);

    // 2. Create Tenant Company
    const company = await CompanyModel.create({ name, currency });

    let user;
    if (existing) {
      user = existing;
    } else {
      // 3. Create Admin User entry in User table
      const passwordHash = await bcrypt.hash(pwd, 10);
      user = await UserModel.create({
        companyId: company.id,
        name: adminUser,
        email,
        passwordHash,
      });
    }

    res.status(201).json({
      id: company.id,
      name: company.name,
      currency: company.currency,
      company,
      user,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTenantProfile(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const updated = await CompanyModel.updateProfile(tenantId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
