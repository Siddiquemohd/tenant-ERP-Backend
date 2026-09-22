import { Response } from 'express';
import { VendorModel } from '../models/vendorModel';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getVendors(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const vendors = await VendorModel.findManyByCompany(companyId);
    res.json(vendors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createVendor(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { name, contactPerson, email, phone, taxId, currency, address, paymentTerms } = req.body;
    if (!name) return res.status(400).json({ error: 'Vendor name is required' });

    const vendor = await VendorModel.create({
      companyId,
      name,
      contactPerson,
      email,
      phone,
      taxId,
      currency: currency || 'USD',
      address,
      paymentTerms,
    });

    res.status(201).json(vendor);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteVendor(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await VendorModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
