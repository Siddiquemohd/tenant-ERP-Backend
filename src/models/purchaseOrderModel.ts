import { prisma } from '../config/db';
import { POStatus } from '@prisma/client';

export class PurchaseOrderModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.purchaseOrder.findMany({
      where: { companyId },
      include: { vendor: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string, companyId: string) {
    return await prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: { vendor: true, company: true, items: true },
    });
  }

  static async create(data: {
    companyId: string;
    vendorId: string;
    poNumber: string;
    issueDate?: Date;
    expectedDate?: Date | null;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    notes?: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      amount: number;
    }>;
  }) {
    return await prisma.purchaseOrder.create({
      data: {
        companyId: data.companyId,
        vendorId: data.vendorId,
        poNumber: data.poNumber,
        status: POStatus.DRAFT,
        issueDate: data.issueDate || new Date(),
        expectedDate: data.expectedDate,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        notes: data.notes,
        items: {
          create: data.items,
        },
      },
      include: { vendor: true, items: true },
    });
  }

  static async updateStatus(id: string, companyId: string, status: POStatus) {
    return await prisma.purchaseOrder.updateMany({
      where: { id, companyId },
      data: { status },
    });
  }

  static async delete(id: string, companyId: string) {
    return await prisma.purchaseOrder.deleteMany({
      where: { id, companyId },
    });
  }
}
