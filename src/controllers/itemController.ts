import { Response } from 'express';
import { ItemModel } from '../models/itemModel';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getItems(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const items = await ItemModel.findManyByCompany(companyId);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createItem(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { name, sku, type, unitPrice, taxRate, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Item name is required' });

    const item = await ItemModel.create({
      companyId,
      name,
      sku,
      type: type || 'PRODUCT',
      unitPrice: parseFloat(unitPrice) || 0,
      taxRate: parseFloat(taxRate) || 0,
      description,
    });

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteItem(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await ItemModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
