import { prisma } from '../config/db';
import { InvoiceStatus } from '@prisma/client';

export class InvoiceModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.invoice.findMany({
      where: { companyId },
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string, companyId: string) {
    return await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { client: true, company: true, items: true },
    });
  }

  static async create(data: {
    companyId: string;
    clientId: string;
    estimateId?: string | null;
    proformaId?: string | null;
    invoiceNumber: string;
    issueDate?: Date;
    dueDate?: Date | null;
    paymentMethod?: string;
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
    return await prisma.invoice.create({
      data: {
        companyId: data.companyId,
        clientId: data.clientId,
        estimateId: data.estimateId,
        proformaId: data.proformaId,
        invoiceNumber: data.invoiceNumber,
        status: InvoiceStatus.DRAFT,
        issueDate: data.issueDate || new Date(),
        dueDate: data.dueDate,
        paymentMethod: data.paymentMethod,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        notes: data.notes,
        items: {
          create: data.items,
        },
      },
      include: { client: true, items: true },
    });
  }

  static async updateStatus(id: string, companyId: string, status: InvoiceStatus, paymentMethod?: string) {
    return await prisma.invoice.updateMany({
      where: { id, companyId },
      data: {
        status,
        ...(paymentMethod ? { paymentMethod } : {}),
      },
    });
  }

  static async delete(id: string, companyId: string) {
    return await prisma.invoice.deleteMany({
      where: { id, companyId },
    });
  }
}
