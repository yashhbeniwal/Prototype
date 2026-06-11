import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { createError } from '../middlewares/error.middleware';
import { createRazorpayOrder, generateUPIPayment, verifyRazorpaySignature, verifyRazorpayWebhook } from '../services/razorpay.service';
import { generateInvoicePDF } from '../utils/pdf.util';
import { uploadToS3 } from '../services/s3.service';
import { sendWhatsAppText } from '../services/whatsapp.service';
import { v4 as uuidv4 } from 'uuid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${random}`;
}

// ─── Invoice CRUD ─────────────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { status, customerId, from, to, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { farmId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, mobile: true, whatsappNumber: true } }, items: true },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true, data: invoices,
      pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string), totalPages: Math.ceil(total / parseInt(limit as string)) },
    });
  } catch (err) { next(err); }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        farm: true,
        items: { include: { animal: { select: { customId: true, name: true, breed: true } } } },
        payments: true,
      },
    });
    if (!invoice) throw createError('Invoice not found', 404);
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.body.farmId;
    const { customerId, items, dueDate, notes, gstNumber, discountAmount = 0 } = req.body;

    if (!items || !items.length) throw createError('Invoice items are required', 400);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw createError('Customer not found', 404);

    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) throw createError('Farm not found', 404);

    // Calculate totals
    const subTotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
    const discountedSubTotal = subTotal - parseFloat(discountAmount);

    // GST: CGST 9% + SGST 9% for intra-state, IGST 18% for inter-state
    const isIntraState = customer.state === 'Maharashtra'; // Customize based on farm state
    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

    items.forEach((item: any) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const gstRate = item.gstRate || 0;
      if (isIntraState) {
        cgstAmount += itemSubtotal * (gstRate / 2 / 100);
        sgstAmount += itemSubtotal * (gstRate / 2 / 100);
      } else {
        igstAmount += itemSubtotal * (gstRate / 100);
      }
    });

    const totalAmount = discountedSubTotal + cgstAmount + sgstAmount + igstAmount;
    const invoiceNumber = generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        farmId,
        gstNumber,
        subTotal,
        discountAmount: parseFloat(discountAmount),
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalAmount,
        balanceAmount: totalAmount,
        dueDate: new Date(dueDate),
        notes,
        items: {
          create: items.map((item: any) => ({
            animalId: item.animalId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            gstRate: item.gstRate || 0,
          })),
        },
      },
      include: { customer: true, farm: true, items: true },
    });

    // Generate UPI payment link if farm has UPI ID
    if (farm.upiId) {
      const { upiLink, qrCodeDataUrl } = await generateUPIPayment(
        farm.upiId, farm.name, totalAmount, invoiceNumber
      );
      await prisma.invoice.update({ where: { id: invoice.id }, data: { upiLink } });
      (invoice as any).upiLink = upiLink;
      (invoice as any).qrCodeDataUrl = qrCodeDataUrl;
    }

    // Update customer outstanding balance
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        outstandingBalance: { increment: totalAmount },
        totalPurchased: { increment: totalAmount },
      },
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
}

export async function generateInvoicePDFEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, farm: true, items: true, payments: true },
    });
    if (!invoice) throw createError('Invoice not found', 404);

    const pdfBuffer = await generateInvoicePDF(invoice as any);
    const result = await uploadToS3(pdfBuffer, `invoice-${invoice.invoiceNumber}.pdf`, 'application/pdf', 'invoices');

    await prisma.invoice.update({ where: { id }, data: { pdfUrl: result.url } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
}

// ─── Payment Recording ────────────────────────────────────────────────────────

export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { invoiceId, amount, paymentMethod, transactionId, notes } = req.body;
    const paymentAmount = parseFloat(amount);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });
    if (!invoice) throw createError('Invoice not found', 404);
    if (paymentAmount > invoice.balanceAmount) {
      throw createError(`Payment amount exceeds balance due (₹${invoice.balanceAmount.toFixed(2)})`, 400);
    }

    const newPaidAmount = invoice.paidAmount + paymentAmount;
    const newBalance = invoice.totalAmount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'PAID' : newPaidAmount > 0 ? 'PARTIALLY_PAID' : invoice.status;

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          paymentMethod: paymentMethod || 'CASH',
          transactionId: transactionId || null,
          notes,
          status: 'SUCCESS',
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaidAmount, balanceAmount: newBalance, status: newStatus },
      }),
      prisma.customer.update({
        where: { id: invoice.customerId },
        data: { outstandingBalance: { decrement: paymentAmount } },
      }),
    ]);

    // Send WhatsApp receipt
    if (invoice.customer.whatsappNumber) {
      const message = `✅ Payment Received\n\nDear ${invoice.customer.name},\n\nAmount: ₹${paymentAmount.toFixed(2)}\nInvoice: ${invoice.invoiceNumber}\nMethod: ${paymentMethod || 'Cash'}\n${transactionId ? `Ref: ${transactionId}\n` : ''}Balance Due: ₹${newBalance.toFixed(2)}\n\nThank you for your payment!\n\n— Goat Farm ERP`;
      await sendWhatsAppText(invoice.customer.whatsappNumber, message).catch(() => {});
    }

    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
}

// ─── Razorpay Order ───────────────────────────────────────────────────────────

export async function createRazorpayOrderEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { invoiceId } = req.body;
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw createError('Invoice not found', 404);

    const order = await createRazorpayOrder(invoice.balanceAmount, invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
    });

    await prisma.invoice.update({ where: { id: invoiceId }, data: { razorpayOrderId: order.orderId } });

    res.json({ success: true, data: order });
  } catch (err) { next(err); }
}

// ─── Razorpay Webhook ─────────────────────────────────────────────────────────

export async function razorpayWebhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const isValid = verifyRazorpayWebhook(JSON.stringify(req.body), signature);

    if (!isValid) {
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const { event, payload } = req.body;

    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const invoice = await prisma.invoice.findFirst({
        where: { razorpayOrderId: payment.order_id },
        include: { customer: true },
      });

      if (invoice) {
        await recordPayment(
          { body: { invoiceId: invoice.id, amount: payment.amount / 100, paymentMethod: 'RAZORPAY', transactionId: payment.id } } as any,
          res,
          next
        );
        return;
      }
    }

    res.json({ success: true, received: true });
  } catch (err) { next(err); }
}

// ─── Billing Dashboard ────────────────────────────────────────────────────────

export async function getBillingDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    if (!farmId) throw createError('Farm ID is required', 400);

    const [
      totalOutstanding, overdueInvoices, paidThisMonth,
      totalInvoiced, recentPayments
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { farmId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
        _sum: { balanceAmount: true },
      }),
      prisma.invoice.count({ where: { farmId, status: 'OVERDUE' } }),
      prisma.payment.aggregate({
        where: {
          invoice: { farmId },
          paymentDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { farmId },
        _sum: { totalAmount: true },
      }),
      prisma.payment.findMany({
        where: { invoice: { farmId } },
        orderBy: { paymentDate: 'desc' },
        take: 10,
        include: { invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalOutstanding: totalOutstanding?._sum?.balanceAmount || 0,
        overdueCount: overdueInvoices,
        collectedThisMonth: paidThisMonth?._sum?.amount || 0,
        totalInvoiced: totalInvoiced?._sum?.totalAmount || 0,
        recentPayments,
      },
    });
  } catch (err) { next(err); }
}
