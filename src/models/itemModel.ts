import { prisma } from '../config/db';
import { ItemType } from '@prisma/client';

export class ItemModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.item.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async create(data: {
    companyId: string;
    name: string;
    sku?: string;
    type?: ItemType;
    unitPrice: number;
    taxRate?: number;
    description?: string;
  }) {
    return await prisma.item.create({ data });
  }

  static async delete(id: string, companyId: string) {
    return await prisma.item.deleteMany({
      where: { id, companyId },
    });
  }
}
