import { Response } from 'express';
import { ClientModel } from '../models/clientModel';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getClients(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const clients = await ClientModel.findManyByCompany(companyId);
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createClient(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { name, contactPerson, email, phone, taxId, currency, billingAddress, shippingAddress } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    const client = await ClientModel.create({
      companyId,
      name,
      contactPerson,
      email,
      phone,
      taxId,
      currency: currency || 'USD',
      billingAddress,
      shippingAddress,
    });

    res.status(201).json(client);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteClient(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    await ClientModel.delete(id, companyId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
