import { Response } from 'express';
import { EstimateModel } from '../models/estimateModel';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getEstimates(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const estimates = await EstimateModel.findManyByCompany(companyId);
    res.json(estimates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getEstimateById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const estimate = await EstimateModel.findById(id, companyId);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createEstimate(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { clientId, estimateNumber, issueDate, expiryDate, notes, items } = req.body;

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

    const estimate = await EstimateModel.create({
      companyId,
      clientId,
      estimateNumber: estimateNumber || `EST-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      items: formattedItems,
    });

    res.status(201).json(estimate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function convertEstimateToProforma(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const pi = await EstimateModel.convertToProforma(id, companyId);
    res.json(pi);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function convertEstimateToInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const inv = await EstimateModel.convertToInvoice(id, companyId);
    res.json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteEstimate(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await EstimateModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
