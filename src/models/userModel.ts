import { prisma } from '../config/db';
import { Role } from '@prisma/client';

export class UserModel {
  static async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });
  }

  static async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: { company: true },
    });
  }

  static async create(data: {
    companyId: string;
    name: string;
    email: string;
    passwordHash: string;
    role?: Role;
    twoFactorSecret?: string;
    twoFactorEnabled?: boolean;
  }) {
    return await prisma.user.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || Role.ADMIN,
        twoFactorSecret: data.twoFactorSecret,
        twoFactorEnabled: data.twoFactorEnabled || false,
      },
      include: { company: true },
    });
  }

  static async update2FASecret(userId: string, secret: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });
  }

  static async set2FAEnabled(userId: string, enabled: boolean) {
    return await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
  }

  static async findByCompany(companyId: string) {
    return await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async delete(id: string, companyId: string) {
    return await prisma.user.deleteMany({
      where: { id, companyId },
    });
  }
}
