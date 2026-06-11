import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { createError } from '../middlewares/error.middleware';
import { generateReportPDF } from '../utils/pdf.util';
import { generateExcelReport } from '../utils/excel.util';

// ─── Animal Report ────────────────────────────────────────────────────────────

export async function getAnimalReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { format = 'json', status, breed, from, to } = req.query;

    const where: any = { farmId };
    if (status) where.status = status;
    if (breed) where.breed = { contains: breed as string, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const animals = await prisma.animal.findMany({
      where,
      include: {
        _count: { select: { vaccinations: true, medicalHistory: true } },
      },
      orderBy: { customId: 'asc' },
    });

    if (format === 'pdf') {
      const pdfBuffer = await generateReportPDF('Animal Report', animals, [
        'customId', 'name', 'breed', 'gender', 'weight', 'status', 'location', 'dateOfBirth',
      ]);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="animal-report.pdf"');
      res.send(pdfBuffer);
      return;
    }

    if (format === 'excel') {
      const excelBuffer = await generateExcelReport('Animals', animals, [
        { key: 'customId', header: 'Animal ID' },
        { key: 'name', header: 'Name' },
        { key: 'breed', header: 'Breed' },
        { key: 'gender', header: 'Gender' },
        { key: 'weight', header: 'Weight (kg)' },
        { key: 'status', header: 'Status' },
        { key: 'location', header: 'Location' },
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="animal-report.xlsx"');
      res.send(excelBuffer);
      return;
    }

    res.json({ success: true, data: animals, total: animals.length });
  } catch (err) { next(err); }
}

// ─── Vaccination Report ───────────────────────────────────────────────────────

export async function getVaccinationReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { format = 'json', status, from, to } = req.query;

    const where: any = { animal: { farmId: farmId || undefined } };
    if (status) where.status = status;
    if (from || to) {
      where.nextDueDate = {};
      if (from) where.nextDueDate.gte = new Date(from as string);
      if (to) where.nextDueDate.lte = new Date(to as string);
    }

    const vaccinations = await prisma.vaccination.findMany({
      where,
      include: { animal: { select: { customId: true, name: true, breed: true } } },
      orderBy: { nextDueDate: 'asc' },
    });

    if (format === 'excel') {
      const excelBuffer = await generateExcelReport('Vaccinations', vaccinations, [
        { key: 'animal.customId', header: 'Animal ID' },
        { key: 'vaccineName', header: 'Vaccine' },
        { key: 'dateGiven', header: 'Date Given' },
        { key: 'nextDueDate', header: 'Next Due' },
        { key: 'status', header: 'Status' },
        { key: 'batchNumber', header: 'Batch No.' },
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="vaccination-report.xlsx"');
      res.send(excelBuffer);
      return;
    }

    res.json({ success: true, data: vaccinations, total: vaccinations.length });
  } catch (err) { next(err); }
}

// ─── Customer Outstanding Report ──────────────────────────────────────────────

export async function getCustomerOutstandingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { format = 'json', minBalance = '0' } = req.query;

    const customers = await prisma.customer.findMany({
      where: { outstandingBalance: { gt: parseFloat(minBalance as string) } },
      orderBy: { outstandingBalance: 'desc' },
      include: {
        invoices: {
          where: { status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
          select: { invoiceNumber: true, totalAmount: true, balanceAmount: true, dueDate: true, status: true },
        },
      },
    });

    if (format === 'excel') {
      const rows = customers.flatMap((c) =>
        c.invoices.map((inv) => ({
          customerName: c.name,
          mobile: c.mobile,
          invoiceNumber: inv.invoiceNumber,
          totalAmount: inv.totalAmount,
          balanceAmount: inv.balanceAmount,
          dueDate: inv.dueDate,
          status: inv.status,
        }))
      );
      const excelBuffer = await generateExcelReport('Outstanding Payments', rows, [
        { key: 'customerName', header: 'Customer' },
        { key: 'mobile', header: 'Mobile' },
        { key: 'invoiceNumber', header: 'Invoice No.' },
        { key: 'totalAmount', header: 'Total (₹)' },
        { key: 'balanceAmount', header: 'Balance (₹)' },
        { key: 'dueDate', header: 'Due Date' },
        { key: 'status', header: 'Status' },
      ]);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="outstanding-report.xlsx"');
      res.send(excelBuffer);
      return;
    }

    const totalOutstanding = customers.reduce((s, c) => s + c.outstandingBalance, 0);
    res.json({ success: true, data: customers, totalOutstanding });
  } catch (err) { next(err); }
}

// ─── Profitability Report ─────────────────────────────────────────────────────

export async function getProfitabilityReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { from, to, groupBy = 'month' } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const [totalRevenue, totalExpenses, feedCost, perBreed] = await Promise.all([
      prisma.revenue.aggregate({
        where: { farmId: farmId || undefined, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { farmId: farmId || undefined, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
        _sum: { amount: true },
      }),
      prisma.feedConsumption.aggregate({
        where: { animal: { farmId: farmId || undefined }, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
        _sum: { totalCost: true },
      }),
      // Profitability by breed
      prisma.$queryRaw`
        SELECT a.breed,
          COALESCE(SUM(r.amount), 0) as total_revenue,
          COALESCE(SUM(e.amount), 0) as total_expenses,
          COUNT(DISTINCT a.id) as animal_count
        FROM "Animal" a
        LEFT JOIN "Revenue" r ON r."animalId" = a.id
        LEFT JOIN "Expense" e ON e."animalId" = a.id
        WHERE a."farmId" = ${farmId}
        GROUP BY a.breed
        ORDER BY (COALESCE(SUM(r.amount), 0) - COALESCE(SUM(e.amount), 0)) DESC
      `,
    ]);

    const grossRevenue = totalRevenue._sum.amount || 0;
    const grossExpenses = (totalExpenses._sum.amount || 0) + (feedCost._sum.totalCost || 0);
    const netProfit = grossRevenue - grossExpenses;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        grossRevenue,
        grossExpenses,
        netProfit,
        profitMargin: profitMargin.toFixed(2),
        byBreed: perBreed,
      },
    });
  } catch (err) { next(err); }
}
