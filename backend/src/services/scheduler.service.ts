import cron from 'node-cron';
import { prisma } from './prisma.service';
import { sendVaccinationReminder, sendPaymentReminder } from './whatsapp.service';
import { sendTelegramMessage } from './telegram.service';
import { logger } from '../utils/logger';
import { NotificationEvent } from '@prisma/client';

/**
 * Start all background cron jobs
 */
export function startScheduler(): void {
  // Run vaccination reminder check at 9:00 AM IST every day
  cron.schedule('30 3 * * *', async () => {
    // 3:30 UTC = 9:00 IST
    logger.info('Running daily vaccination reminder job...');
    await processVaccinationReminders();
  });

  // Run payment overdue check at 10:00 AM IST every day
  cron.schedule('30 4 * * *', async () => {
    // 4:30 UTC = 10:00 IST
    logger.info('Running daily payment reminder job...');
    await processPaymentReminders();
  });

  // Run stock level check at 8:00 AM IST every day
  cron.schedule('30 2 * * *', async () => {
    logger.info('Running feed stock alert job...');
    await processFeedStockAlerts();
  });

  // Mark overdue vaccinations at midnight IST daily
  cron.schedule('30 18 * * *', async () => {
    // 18:30 UTC = 00:00 IST
    logger.info('Running vaccination overdue mark job...');
    await markOverdueVaccinations();
  });

  // Mark overdue invoices daily
  cron.schedule('30 18 * * *', async () => {
    await markOverdueInvoices();
  });

  logger.info('✅  Scheduler started — vaccination, payment, and stock jobs active');
}

// ─────────────────────────────────────────────────────
// Vaccination Reminders
// ─────────────────────────────────────────────────────

async function processVaccinationReminders(): Promise<void> {
  const now = new Date();

  const reminderWindows = [
    { days: 30, field: 'reminder30Sent' as const },
    { days: 7, field: 'reminder7Sent' as const },
    { days: 1, field: 'reminder1Sent' as const },
  ];

  for (const { days, field } of reminderWindows) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const dueVaccinations = await prisma.vaccination.findMany({
      where: {
        nextDueDate: { gte: start, lte: end },
        status: 'PENDING',
        [field]: false,
      },
      include: {
        animal: {
          include: {
            farm: { select: { id: true, name: true, users: { select: { whatsappNumber: true, role: true } } } },
          },
        },
      },
    });

    logger.info(`Found ${dueVaccinations.length} vaccinations due in ${days} days`);

    for (const vaccination of dueVaccinations) {
      const animal = vaccination.animal;
      const farm = animal.farm;

      // Notify farm managers and owners
      const notifyUsers = farm.users.filter(
        (u) => u.whatsappNumber && ['OWNER', 'MANAGER', 'VETERINARIAN'].includes(u.role)
      );

      for (const user of notifyUsers) {
        try {
          await sendVaccinationReminder(
            user.whatsappNumber!,
            animal.customId,
            animal.name || animal.customId,
            vaccination.vaccineName,
            vaccination.nextDueDate,
            days,
            farm.id
          );
        } catch (e) {
          logger.warn(`Failed to send vaccination reminder: ${e}`);
        }
      }

      // Mark reminder as sent
      await prisma.vaccination.update({
        where: { id: vaccination.id },
        data: { [field]: true },
      });
    }
  }
}

// ─────────────────────────────────────────────────────
// Payment Reminders
// ─────────────────────────────────────────────────────

async function processPaymentReminders(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find overdue invoices with outstanding balance
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      dueDate: { lt: new Date() },
      balanceAmount: { gt: 0 },
      reminderSent: false,
    },
    include: {
      customer: { select: { name: true, whatsappNumber: true, mobile: true } },
      farm: { select: { id: true, name: true } },
    },
    take: 100,
  });

  logger.info(`Processing ${overdueInvoices.length} overdue payment reminders`);

  for (const invoice of overdueInvoices) {
    const customer = invoice.customer;
    if (!customer.whatsappNumber) continue;

    try {
      await sendPaymentReminder(
        customer.whatsappNumber,
        customer.name,
        invoice.invoiceNumber,
        invoice.balanceAmount,
        invoice.dueDate,
        invoice.farmId
      );

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { reminderSent: true },
      });
    } catch (e) {
      logger.warn(`Failed to send payment reminder for invoice ${invoice.invoiceNumber}: ${e}`);
    }
  }
}

// ─────────────────────────────────────────────────────
// Feed Stock Alerts
// ─────────────────────────────────────────────────────

async function processFeedStockAlerts(): Promise<void> {
  const lowStockItems = await prisma.feedInventory.findMany({
    where: {
      availableStock: { lte: prisma.feedInventory.fields.minimumThreshold },
    },
    include: {
      farm: {
        include: {
          users: {
            where: { role: { in: ['OWNER', 'MANAGER'] }, isActive: true },
            select: { telegramChatId: true, whatsappNumber: true },
          },
        },
      },
    },
  });

  for (const item of lowStockItems) {
    const message = `⚠️ Low Feed Stock Alert!\n\nFeed: ${item.feedType}\nAvailable: ${item.availableStock}kg\nMinimum Required: ${item.minimumThreshold}kg\nFarm: ${item.farm.name}\n\nPlease reorder immediately.`;

    for (const user of item.farm.users) {
      if (user.telegramChatId) {
        try {
          await sendTelegramMessage(user.telegramChatId, message, item.farmId, NotificationEvent.STOCK_LOW);
        } catch (e) {
          logger.warn(`Failed to send Telegram stock alert: ${e}`);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────
// Mark Overdue Records
// ─────────────────────────────────────────────────────

async function markOverdueVaccinations(): Promise<void> {
  const updated = await prisma.vaccination.updateMany({
    where: {
      nextDueDate: { lt: new Date() },
      status: 'PENDING',
    },
    data: { status: 'OVERDUE' },
  });
  logger.info(`Marked ${updated.count} vaccinations as OVERDUE`);
}

async function markOverdueInvoices(): Promise<void> {
  const updated = await prisma.invoice.updateMany({
    where: {
      dueDate: { lt: new Date() },
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
    },
    data: { status: 'OVERDUE' },
  });
  logger.info(`Marked ${updated.count} invoices as OVERDUE`);
}
