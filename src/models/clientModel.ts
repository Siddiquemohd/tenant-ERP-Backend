import { prisma } from '../config/db';

export class ClientModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.client.findMany({
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
    billingAddress?: string;
    shippingAddress?: string;
  }) {
    return await prisma.client.create({
      data: {
        ...data,
        currency: data.currency || 'USD',
      },
    });
  }

  static async delete(id: string, companyId: string) {
    return await prisma.client.deleteMany({
      where: { id, companyId },
    });
  }
}
