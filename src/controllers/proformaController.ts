import { Response } from 'express';
import { ProformaModel } from '../models/proformaModel';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getProformaInvoices(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const pis = await ProformaModel.findManyByCompany(companyId);
    res.json(pis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProformaById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const pi = await ProformaModel.findById(id, companyId);
    if (!pi) return res.status(404).json({ error: 'Proforma Invoice not found' });
    res.json(pi);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createProformaInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { clientId, piNumber, issueDate, dueDate, notes, items } = req.body;

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

    const pi = await ProformaModel.create({
      companyId,
      clientId,
      piNumber: piNumber || `PI-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      items: formattedItems,
    });

    res.status(201).json(pi);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function convertProformaToInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const inv = await ProformaModel.convertToInvoice(id, companyId);
    res.json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteProforma(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await ProformaModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
