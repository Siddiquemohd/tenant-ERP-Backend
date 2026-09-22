import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { Role } from '@prisma/client';

export async function getUsers(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    const users = await UserModel.findByCompany(tenantId);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({
      companyId: tenantId,
      name,
      email,
      passwordHash,
      role: role === 'ADMIN' ? Role.ADMIN : Role.STAFF,
    });

    const { passwordHash: _, twoFactorSecret: __, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own active account' });
    }

    await UserModel.delete(id, tenantId);
    res.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
