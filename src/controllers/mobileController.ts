import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { UserModel } from '../models/userModel';
import { CompanyModel } from '../models/companyModel';
import { ClientModel } from '../models/clientModel';
import { VendorModel } from '../models/vendorModel';
import { ItemModel } from '../models/itemModel';
import { EstimateModel } from '../models/estimateModel';
import { ProformaModel } from '../models/proformaModel';
import { InvoiceModel } from '../models/invoiceModel';
import { PurchaseOrderModel } from '../models/purchaseOrderModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { generateTOTPSecret, generateQRCodeDataURL, verifyTOTPCode } from '../utils/totp';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'tenant_erp_super_secret_jwt_key_2026';

/**
 * ============================================================================
 * MOBILE AUTHENTICATION CONTROLLERS
 * ============================================================================
 */

export async function mobileLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.company) {
      return res.status(400).json({ error: 'User is not associated with any valid tenant company' });
    }

    // Direct Mobile Authentication (Bypasses TOTP 2FA for Mobile Apps)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { passwordHash, twoFactorSecret, ...userWithoutPassword } = user;

    res.json({
      token,
      tenantId: user.companyId,
      user: userWithoutPassword,
      company: user.company,
      message: 'Mobile login successful',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileVerify2FA(req: Request, res: Response) {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Temporary token and 6-digit TOTP code are required' });
    }

    const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
    if (!decoded || !decoded.userId || !decoded.isTemp2FA) {
      return res.status(401).json({ error: 'Invalid or expired 2FA session' });
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let secretToVerify = '';
    if (decoded.isFirstTime2FA) {
      secretToVerify = decoded.tempSecret;
    } else {
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: '2FA secret not configured for this user' });
      }
      secretToVerify = user.twoFactorSecret;
    }

    const isValid = verifyTOTPCode(secretToVerify, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit Google Authenticator code' });
    }

    if (decoded.isFirstTime2FA) {
      await UserModel.update2FASecret(user.id, decoded.tempSecret);
      await UserModel.set2FAEnabled(user.id, true);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const updatedUser = decoded.isFirstTime2FA ? await UserModel.findById(user.id) : user;
    const { passwordHash, twoFactorSecret, ...userWithoutPassword } = updatedUser || user;

    res.json({
      token,
      tenantId: user.companyId,
      user: userWithoutPassword,
      company: user.company,
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired 2FA code verification' });
  }
}

export async function mobileGetMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user || !req.tenantId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { passwordHash, twoFactorSecret, ...userWithoutPassword } = req.user;
    const company = await CompanyModel.findById(req.tenantId);

    res.json({
      user: userWithoutPassword,
      tenantId: req.tenantId,
      company,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * ============================================================================
 * MOBILE DASHBOARD & ANALYTICS CONTROLLER
 * ============================================================================
 */

export async function mobileGetDashboard(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const company = await CompanyModel.findById(companyId);

    const [
      clientCount,
      vendorCount,
      itemCount,
      estimateCount,
      proformaCount,
      invoiceCount,
      poCount,
      userCount,
      recentInvoices,
      recentEstimates,
      paidInvoicesSum,
      allInvoicesSum,
    ] = await Promise.all([
      prisma.client.count({ where: { companyId } }),
      prisma.vendor.count({ where: { companyId } }),
      prisma.item.count({ where: { companyId } }),
      prisma.estimate.count({ where: { companyId } }),
      prisma.proformaInvoice.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId } }),
      prisma.purchaseOrder.count({ where: { companyId } }),
      prisma.user.count({ where: { companyId } }),
      prisma.invoice.findMany({
        where: { companyId },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.estimate.findMany({
        where: { companyId },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.invoice.aggregate({
        where: { companyId, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { companyId },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalRevenue = paidInvoicesSum._sum.totalAmount || 0;
    const totalInvoiced = allInvoicesSum._sum.totalAmount || 0;

    res.json({
      company,
      tenantId: companyId,
      counts: {
        clients: clientCount,
        vendors: vendorCount,
        items: itemCount,
        estimates: estimateCount,
        proformaInvoices: proformaCount,
        invoices: invoiceCount,
        purchaseOrders: poCount,
        users: userCount,
      },
      financials: {
        currency: company?.currency || 'USD',
        totalRevenue,
        totalInvoiced,
      },
      recentInvoices,
      recentEstimates,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * ============================================================================
 * MOBILE TEAM & USER MANAGEMENT CONTROLLERS
 * ============================================================================
 */

export async function mobileGetUsers(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });
    const users = await UserModel.findByCompany(tenantId);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileCreateUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({
      companyId: tenantId,
      name,
      email,
      passwordHash,
      role: role === 'ADMIN' ? Role.ADMIN : Role.STAFF,
    });

    const { passwordHash: _, twoFactorSecret: __, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileDeleteUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own active account' });
    }

    await UserModel.delete(id, tenantId);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * ============================================================================
 * MOBILE CLIENT CONTROLLERS
 * ============================================================================
 */

export async function mobileGetClients(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const clients = await ClientModel.findManyByCompany(companyId);
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileCreateClient(req: AuthRequest, res: Response) {
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

export async function mobileDeleteClient(req: AuthRequest, res: Response) {
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

/**
 * ============================================================================
 * MOBILE VENDOR CONTROLLERS
 * ============================================================================
 */

export async function mobileGetVendors(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const vendors = await VendorModel.findManyByCompany(companyId);
    res.json(vendors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileCreateVendor(req: AuthRequest, res: Response) {
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

export async function mobileDeleteVendor(req: AuthRequest, res: Response) {
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

/**
 * ============================================================================
 * MOBILE ITEM / INVENTORY CONTROLLERS
 * ============================================================================
 */

export async function mobileGetItems(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const items = await ItemModel.findManyByCompany(companyId);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileCreateItem(req: AuthRequest, res: Response) {
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

export async function mobileDeleteItem(req: AuthRequest, res: Response) {
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

/**
 * ============================================================================
 * MOBILE ESTIMATE CONTROLLERS
 * ============================================================================
 */

export async function mobileGetEstimates(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const estimates = await EstimateModel.findManyByCompany(companyId);
    res.json(estimates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileGetEstimateById(req: AuthRequest, res: Response) {
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

export async function mobileCreateEstimate(req: AuthRequest, res: Response) {
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

export async function mobileConvertEstimateToProforma(req: AuthRequest, res: Response) {
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

export async function mobileConvertEstimateToInvoice(req: AuthRequest, res: Response) {
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

export async function mobileDeleteEstimate(req: AuthRequest, res: Response) {
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

/**
 * ============================================================================
 * MOBILE PROFORMA INVOICE CONTROLLERS
 * ============================================================================
 */

export async function mobileGetProformaInvoices(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const list = await ProformaModel.findManyByCompany(companyId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileGetProformaById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const item = await ProformaModel.findById(id, companyId);
    if (!item) return res.status(404).json({ error: 'Proforma Invoice not found' });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileCreateProformaInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { clientId, estimateId, piNumber, issueDate, dueDate, notes, items } = req.body;

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
      estimateId,
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

export async function mobileConvertProformaToInvoice(req: AuthRequest, res: Response) {
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

export async function mobileDeleteProforma(req: AuthRequest, res: Response) {
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

/**
 * ============================================================================
 * MOBILE TAX INVOICE CONTROLLERS
 * ============================================================================
 */

export async function mobileGetInvoices(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const invoices = await InvoiceModel.findManyByCompany(companyId);
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileGetInvoiceById(req: AuthRequest, res: Response) {
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

export async function mobileCreateInvoice(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { clientId, estimateId, proformaId, invoiceNumber, issueDate, dueDate, notes, items, paymentMethod } = req.body;

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

    const invoice = await InvoiceModel.create({
      companyId,
      clientId,
      estimateId,
      proformaId,
      invoiceNumber: invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      subtotal,
      taxAmount,
      totalAmount,
      paymentMethod,
      notes,
      items: formattedItems,
    });

    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileUpdateInvoiceStatus(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { id } = req.params;
    const { status, paymentMethod } = req.body;

    const invoice = await InvoiceModel.updateStatus(id, companyId, status, paymentMethod);
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileDeleteInvoice(req: AuthRequest, res: Response) {
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

/**
 * ============================================================================
 * MOBILE PURCHASE ORDER CONTROLLERS
 * ============================================================================
 */

export async function mobileGetPurchaseOrders(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const orders = await PurchaseOrderModel.findManyByCompany(companyId);
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileGetPOById(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const order = await PurchaseOrderModel.findById(id, companyId);
    if (!order) return res.status(404).json({ error: 'Purchase Order not found' });
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileCreatePurchaseOrder(req: AuthRequest, res: Response) {
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

export async function mobileUpdatePOStatus(req: AuthRequest, res: Response) {
  try {
    const companyId = req.tenantId;
    if (!companyId) return res.status(400).json({ error: 'Tenant context required' });

    const { id } = req.params;
    const { status } = req.body;

    const po = await PurchaseOrderModel.updateStatus(id, companyId, status);
    res.json(po);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function mobileDeletePurchaseOrder(req: AuthRequest, res: Response) {
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
