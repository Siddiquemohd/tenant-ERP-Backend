import { PrismaClient, Role, ItemType, EstimateStatus, PIStatus, InvoiceStatus, POStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Multi-Tenant ERP Database...');

  // Clean data
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.proformaInvoiceItem.deleteMany();
  await prisma.proformaInvoice.deleteMany();
  await prisma.estimateItem.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.item.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await bcrypt.hash('admin123', 10);

  // Tenant 1: Acme Global Logistics
  const tenant1 = await prisma.company.create({
    data: {
      name: 'Acme Global Logistics',
      legalName: 'Acme Global Logistics Pvt. Ltd.',
      email: 'billing@acmeglobal.com',
      phone: '+1 (555) 234-5678',
      website: 'https://acmeglobal.com',
      address: '100 Innovation Way, Suite 400, Tech Park, NY 10001',
      taxId: 'US-EIN-987654321',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=80&fit=crop',
      currency: 'USD',
      bankName: 'Silicon Valley Commercial Bank',
      accountName: 'Acme Global Logistics Operations',
      accountNumber: '9876543210123',
      routingNumber: 'SVCB0001234',
      branchName: 'Manhattan Wall St Branch',
    },
  });

  // Tenant 2: Apex Industrial Supplies
  const tenant2 = await prisma.company.create({
    data: {
      name: 'Apex Industrial Supplies',
      legalName: 'Apex Industrial Supplies Inc.',
      email: 'finance@apexsupplies.io',
      phone: '+1 (555) 987-6543',
      website: 'https://apexsupplies.io',
      address: '450 Commerce Boulevard, Chicago, IL 60601',
      taxId: 'US-EIN-123456789',
      logoUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=200&h=80&fit=crop',
      currency: 'USD',
      bankName: 'First National Bank of Chicago',
      accountName: 'Apex Industrial Operating Account',
      accountNumber: '1122334455667',
      routingNumber: 'FNBC0009876',
      branchName: 'Downtown Loop Branch',
    },
  });

  // Users
  await prisma.user.create({
    data: {
      companyId: tenant1.id,
      name: 'John Doe (Admin)',
      email: 'admin@acmeglobal.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      companyId: tenant2.id,
      name: 'Apex Finance Admin',
      email: 'finance@apexsupplies.io',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // Clients
  const client1 = await prisma.client.create({
    data: {
      companyId: tenant1.id,
      name: 'Starlight Tech Solutions',
      contactPerson: 'Alice Vance',
      email: 'alice@starlighttech.com',
      phone: '+1 (555) 444-1212',
      taxId: 'TAX-ST-9911',
      billingAddress: '789 Enterprise Blvd, Austin, TX 78701',
      shippingAddress: '789 Enterprise Blvd, Warehouse B, Austin, TX 78701',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      companyId: tenant1.id,
      name: 'Nexus Retail Chains',
      contactPerson: 'Robert Miller',
      email: 'procurement@nexusretail.com',
      phone: '+1 (555) 333-8899',
      taxId: 'TAX-NR-5544',
      billingAddress: '12 Gateway Plaza, San Francisco, CA 94105',
    },
  });

  // Vendors
  const vendor1 = await prisma.vendor.create({
    data: {
      companyId: tenant1.id,
      name: 'Oceanic Freight Systems',
      contactPerson: 'Marcus Brody',
      email: 'sales@oceanicfreight.com',
      phone: '+1 (555) 888-2233',
      taxId: 'VEND-OF-3321',
      address: '50 Deepwater Port Road, Seattle, WA 98101',
      paymentTerms: 'Net 30',
    },
  });

  // Catalog Items
  await prisma.item.create({
    data: {
      companyId: tenant1.id,
      name: 'Air Freight Handling (Per Ton)',
      sku: 'SRV-AF-001',
      type: ItemType.SERVICE,
      unitPrice: 1250.0,
      taxRate: 5.0,
      description: 'Standard international air cargo handling per metric ton',
    },
  });

  await prisma.item.create({
    data: {
      companyId: tenant1.id,
      name: 'Heavy-Duty Wooden Pallets (10-Pack)',
      sku: 'PRD-PL-100',
      type: ItemType.PRODUCT,
      unitPrice: 180.0,
      taxRate: 8.0,
      description: 'Heat-treated wooden shipping pallets 48x40 inch',
    },
  });

  // Estimate
  const est1 = await prisma.estimate.create({
    data: {
      companyId: tenant1.id,
      clientId: client1.id,
      estimateNumber: 'EST-2026-001',
      status: EstimateStatus.APPROVED,
      issueDate: new Date(),
      expiryDate: new Date(Date.now() + 14 * 86400000),
      subtotal: 2950.0,
      taxAmount: 147.5,
      totalAmount: 3097.5,
      notes: 'Estimate valid for 14 days from issue date. Terms apply.',
      items: {
        create: [
          { description: 'Air Freight Handling (Per Ton) - 2 Tons', quantity: 2, unitPrice: 1250.0, taxRate: 5.0, amount: 2500.0 },
          { description: 'Customs Clearance Expedited', quantity: 1, unitPrice: 450.0, taxRate: 5.0, amount: 450.0 },
        ],
      },
    },
  });

  // Proforma Invoice
  await prisma.proformaInvoice.create({
    data: {
      companyId: tenant1.id,
      clientId: client1.id,
      estimateId: est1.id,
      piNumber: 'PI-2026-001',
      status: PIStatus.SENT,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 86400000),
      subtotal: 2950.0,
      taxAmount: 147.5,
      totalAmount: 3097.5,
      notes: 'Proforma Invoice for advance payment. Please deposit funds into bank account below.',
      items: {
        create: [
          { description: 'Air Freight Handling (Per Ton) - 2 Tons', quantity: 2, unitPrice: 1250.0, taxRate: 5.0, amount: 2500.0 },
          { description: 'Customs Clearance Expedited', quantity: 1, unitPrice: 450.0, taxRate: 5.0, amount: 450.0 },
        ],
      },
    },
  });

  // Invoice
  await prisma.invoice.create({
    data: {
      companyId: tenant1.id,
      clientId: client2.id,
      invoiceNumber: 'INV-2026-001',
      status: InvoiceStatus.PAID,
      issueDate: new Date(Date.now() - 5 * 86400000),
      dueDate: new Date(Date.now() + 25 * 86400000),
      subtotal: 1800.0,
      taxAmount: 144.0,
      totalAmount: 1944.0,
      paymentMethod: 'Bank Wire Transfer',
      notes: 'Thank you for your business! Payment received in full.',
      items: {
        create: [
          { description: 'Heavy-Duty Wooden Pallets (10-Pack)', quantity: 10, unitPrice: 180.0, taxRate: 8.0, amount: 1800.0 },
        ],
      },
    },
  });

  // Purchase Order
  await prisma.purchaseOrder.create({
    data: {
      companyId: tenant1.id,
      vendorId: vendor1.id,
      poNumber: 'PO-2026-001',
      status: POStatus.SENT,
      issueDate: new Date(),
      expectedDate: new Date(Date.now() + 10 * 86400000),
      subtotal: 5000.0,
      taxAmount: 250.0,
      totalAmount: 5250.0,
      notes: 'Deliver to Warehouse A, Bay 4. Include packing slip.',
      items: {
        create: [
          { description: 'Bulk Container Vessel Slot Reservation', quantity: 1, unitPrice: 5000.0, taxRate: 5.0, amount: 5000.0 },
        ],
      },
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
