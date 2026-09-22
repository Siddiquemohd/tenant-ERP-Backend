import { prisma } from '../config/db';

export class VendorModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.vendor.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async create(data: {
    companyId: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    taxId?: string;
    currency?: string;
    address?: string;
    paymentTerms?: string;
  }) {
    return await prisma.vendor.create({
      data: {
        ...data,
        currency: data.currency || 'USD',
      },
    });
  }

  static async delete(id: string, companyId: string) {
    return await prisma.vendor.deleteMany({
      where: { id, companyId },
    });
  }
}
