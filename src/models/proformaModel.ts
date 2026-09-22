import { prisma } from '../config/db';
import { PIStatus, InvoiceStatus } from '@prisma/client';

export class ProformaModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.proformaInvoice.findMany({
      where: { companyId },
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string, companyId: string) {
    return await prisma.proformaInvoice.findFirst({
      where: { id, companyId },
      include: { client: true, company: true, items: true },
    });
  }

  static async create(data: {
    companyId: string;
    clientId: string;
    estimateId?: string | null;
    piNumber: string;
    issueDate?: Date;
    dueDate?: Date | null;
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
    return await prisma.proformaInvoice.create({
      data: {
        companyId: data.companyId,
        clientId: data.clientId,
        estimateId: data.estimateId,
        piNumber: data.piNumber,
        status: PIStatus.DRAFT,
        issueDate: data.issueDate || new Date(),
        dueDate: data.dueDate,
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

  static async convertToInvoice(id: string, companyId: string) {
    const pi = await prisma.proformaInvoice.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!pi) throw new Error('Proforma Invoice not found');

    const count = await prisma.invoice.count({ where: { companyId } });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const inv = await prisma.invoice.create({
      data: {
        companyId: pi.companyId,
        clientId: pi.clientId,
        proformaId: pi.id,
        estimateId: pi.estimateId,
        invoiceNumber,
        status: InvoiceStatus.SENT,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: pi.subtotal,
        taxAmount: pi.taxAmount,
        totalAmount: pi.totalAmount,
        notes: pi.notes,
        items: {
          create: pi.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            amount: i.amount,
          })),
        },
      },
    });

    await prisma.proformaInvoice.update({
      where: { id },
      data: { status: PIStatus.CONVERTED },
    });

    return inv;
  }

  static async delete(id: string, companyId: string) {
    return await prisma.proformaInvoice.deleteMany({
      where: { id, companyId },
    });
  }
}
