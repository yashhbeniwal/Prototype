import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { createError } from '../middlewares/error.middleware';

export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, country, page = '1', limit = '20', sortBy = 'name' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { mobile: { contains: search as string } },
        { whatsappNumber: { contains: search as string } },
      ];
    }
    if (country) where.country = country;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: sortBy === 'outstanding' ? { outstandingBalance: 'desc' } : { name: 'asc' },
        include: { _count: { select: { invoices: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true, data: customers,
      pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string), totalPages: Math.ceil(total / parseInt(limit as string)) },
    });
  } catch (err) { next(err); }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { payments: true },
        },
      },
    });
    if (!customer) throw createError('Customer not found', 404);
    res.json({ success: true, data: customer });
  } catch (err) { next(err); }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, mobile, whatsappNumber, email, country, state, city, address, gstNumber, notes } = req.body;

    const customer = await prisma.customer.create({
      data: { name, mobile, whatsappNumber, email, country, state, city, address, gstNumber, notes },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (err) { next(err); }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await prisma.customer.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function getCustomerLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : undefined,
          orderBy: { createdAt: 'asc' },
          include: { payments: true, items: true },
        },
      },
    });
    if (!customer) throw createError('Customer not found', 404);

    // Build ledger entries
    const ledger: any[] = [];
    let runningBalance = 0;

    customer.invoices.forEach((inv) => {
      runningBalance += inv.totalAmount;
      ledger.push({
        date: inv.createdAt,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        debit: inv.totalAmount,
        credit: 0,
        balance: runningBalance,
      });

      inv.payments.forEach((pmt) => {
        runningBalance -= pmt.amount;
        ledger.push({
          date: pmt.paymentDate,
          type: 'PAYMENT',
          reference: pmt.transactionId || 'Cash Payment',
          debit: 0,
          credit: pmt.amount,
          balance: runningBalance,
        });
      });
    });

    const summary = {
      totalInvoiced: customer.invoices.reduce((s, i) => s + i.totalAmount, 0),
      totalPaid: customer.invoices.reduce((s, i) => s + i.paidAmount, 0),
      outstandingBalance: customer.outstandingBalance,
    };

    res.json({ success: true, data: { customer, ledger, summary } });
  } catch (err) { next(err); }
}

export async function getTopDebtors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit = '10' } = req.query;
    const customers = await prisma.customer.findMany({
      where: { outstandingBalance: { gt: 0 } },
      orderBy: { outstandingBalance: 'desc' },
      take: parseInt(limit as string),
      select: { id: true, name: true, mobile: true, whatsappNumber: true, outstandingBalance: true, totalPurchased: true },
    });
    res.json({ success: true, data: customers });
  } catch (err) { next(err); }
}
