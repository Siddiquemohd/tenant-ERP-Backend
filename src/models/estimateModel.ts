import { prisma } from '../config/db';
import { EstimateStatus, PIStatus, InvoiceStatus } from '@prisma/client';

export class EstimateModel {
  static async findManyByCompany(companyId: string) {
    return await prisma.estimate.findMany({
      where: { companyId },
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string, companyId: string) {
    return await prisma.estimate.findFirst({
      where: { id, companyId },
      include: { client: true, company: true, items: true },
    });
  }

  static async create(data: {
    companyId: string;
    clientId: string;
    estimateNumber: string;
    issueDate?: Date;
    expiryDate?: Date | null;
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
    return await prisma.estimate.create({
      data: {
        companyId: data.companyId,
        clientId: data.clientId,
        estimateNumber: data.estimateNumber,
        status: EstimateStatus.DRAFT,
        issueDate: data.issueDate || new Date(),
        expiryDate: data.expiryDate,
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

  static async convertToProforma(id: string, companyId: string) {
    const est = await prisma.estimate.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!est) throw new Error('Estimate not found');

    const count = await prisma.proformaInvoice.count({ where: { companyId } });
    const piNumber = `PI-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const pi = await prisma.proformaInvoice.create({
      data: {
        companyId: est.companyId,
        clientId: est.clientId,
        estimateId: est.id,
        piNumber,
        status: PIStatus.SENT,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        subtotal: est.subtotal,
        taxAmount: est.taxAmount,
        totalAmount: est.totalAmount,
        notes: est.notes,
        items: {
          create: est.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            amount: i.amount,
          })),
        },
      },
    });

    await prisma.estimate.update({
      where: { id },
      data: { status: EstimateStatus.CONVERTED },
    });

    return pi;
  }

  static async convertToInvoice(id: string, companyId: string) {
    const est = await prisma.estimate.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!est) throw new Error('Estimate not found');

    const count = await prisma.invoice.count({ where: { companyId } });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const inv = await prisma.invoice.create({
      data: {
        companyId: est.companyId,
        clientId: est.clientId,
        estimateId: est.id,
        invoiceNumber,
        status: InvoiceStatus.SENT,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: est.subtotal,
        taxAmount: est.taxAmount,
        totalAmount: est.totalAmount,
        notes: est.notes,
        items: {
          create: est.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            amount: i.amount,
          })),
        },
      },
    });

    await prisma.estimate.update({
      where: { id },
      data: { status: EstimateStatus.CONVERTED },
    });

    return inv;
  }

  static async delete(id: string, companyId: string) {
    return await prisma.estimate.deleteMany({
      where: { id, companyId },
    });
  }
}
