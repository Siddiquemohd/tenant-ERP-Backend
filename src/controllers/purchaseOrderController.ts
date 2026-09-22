import { Response } from 'express';
import { PurchaseOrderModel } from '../models/purchaseOrderModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { POStatus } from '@prisma/client';

export async function getPurchaseOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const pos = await PurchaseOrderModel.findManyByCompany(companyId);
    res.json(pos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPOById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const po = await PurchaseOrderModel.findById(id, companyId);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    res.json(po);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createPurchaseOrder(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { vendorId, poNumber, issueDate, expectedDate, notes, items } = req.body;

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

    const po = await PurchaseOrderModel.create({
      companyId,
      vendorId,
      poNumber: poNumber || `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      items: formattedItems,
    });

    res.status(201).json(po);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updatePOStatus(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const { status } = req.body;

    const updated = await PurchaseOrderModel.updateStatus(id, companyId, status as POStatus);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deletePurchaseOrder(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await PurchaseOrderModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
