import { prisma } from '../config/db';

export class CompanyModel {
  static async findMany() {
    return await prisma.company.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  static async findById(id: string) {
    return await prisma.company.findUnique({
      where: { id },
    });
  }

  static async create(data: { name: string; currency?: string }) {
    return await prisma.company.create({
      data: {
        name: data.name,
        currency: data.currency || 'USD',
      },
    });
  }

  static async updateProfile(id: string, data: any) {
    return await prisma.company.update({
      where: { id },
      data,
    });
  }
}
