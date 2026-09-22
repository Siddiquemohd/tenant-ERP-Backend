import { Response } from 'express';
import { InvoiceModel } from '../models/invoiceModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { InvoiceStatus } from '@prisma/client';

export async function getInvoices(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const invoices = await InvoiceModel.findManyByCompany(companyId);
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getInvoiceById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const invoice = await InvoiceModel.findById(id, companyId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { clientId, invoiceNumber, issueDate, dueDate, paymentMethod, notes, items } = req.body;

    let subtotal = 0;
    let taxAmount = 0;

    const formattedItems = (items || []).map((item: any) => {
      const itemSubtotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0);
      const itemTax = itemSubtotal * ((parseFloat(item.taxRate) || 0) / 100);
      const amount = itemSubtotal + itemTax;
      subtotal += itemSubtotal;
      taxAmount += itemTax;

      return {
        description: item.description,
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        taxRate: parseFloat(item.taxRate) || 0,
        amount,
      };
    });

    const totalAmount = subtotal + taxAmount;

    const inv = await InvoiceModel.create({
      companyId,
      clientId,
      invoiceNumber: invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      paymentMethod,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      items: formattedItems,
    });

    res.status(201).json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateInvoiceStatus(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const { status, paymentMethod } = req.body;

    const updated = await InvoiceModel.updateStatus(id, companyId, status as InvoiceStatus, paymentMethod);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await InvoiceModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
