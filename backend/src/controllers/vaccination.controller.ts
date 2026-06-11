import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { createError } from '../middlewares/error.middleware';
import { sendVaccinationReminder } from '../services/whatsapp.service';

// ─── List vaccinations ────────────────────────────────────────────────────────

export async function listVaccinations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { animalId, status, dueFrom, dueTo, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (animalId) where.animalId = animalId;
    if (status) where.status = status;
    if (farmId) where.animal = { farmId };
    if (dueFrom || dueTo) {
      where.nextDueDate = {};
      if (dueFrom) where.nextDueDate.gte = new Date(dueFrom as string);
      if (dueTo) where.nextDueDate.lte = new Date(dueTo as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [vaccinations, total] = await Promise.all([
      prisma.vaccination.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { nextDueDate: 'asc' },
        include: {
          animal: { select: { customId: true, name: true, breed: true } },
          administeredBy: { select: { name: true } },
        },
      }),
      prisma.vaccination.count({ where }),
    ]);

    res.json({
      success: true,
      data: vaccinations,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get due vaccinations ────────────────────────────────────────────────────

export async function getDueVaccinations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { days = '30' } = req.query;

    const cutoffDate = new Date(Date.now() + parseInt(days as string) * 24 * 60 * 60 * 1000);

    const due = await prisma.vaccination.findMany({
      where: {
        animal: { farmId: farmId || undefined },
        nextDueDate: { lte: cutoffDate },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { nextDueDate: 'asc' },
      include: {
        animal: { select: { customId: true, name: true, breed: true, location: true } },
      },
    });

    // Group by urgency
    const now = new Date();
    const overdue = due.filter((v) => v.nextDueDate < now);
    const today = due.filter((v) => {
      const d = v.nextDueDate;
      return d >= now && d <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
    });
    const thisWeek = due.filter((v) => {
      const d = v.nextDueDate;
      return d > new Date(now.getTime() + 24 * 60 * 60 * 1000) && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    });
    const later = due.filter((v) => v.nextDueDate > new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

    res.json({ success: true, data: { overdue, today, thisWeek, later, total: due.length } });
  } catch (err) {
    next(err);
  }
}

// ─── Create vaccination record ────────────────────────────────────────────────

export async function createVaccination(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      animalId, vaccineName, disease, dateGiven, nextDueDate,
      batchNumber, manufacturer, dosage, notes,
    } = req.body;

    const animal = await prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) throw createError('Animal not found', 404);

    const vaccination = await prisma.vaccination.create({
      data: {
        animalId,
        vaccineName,
        disease,
        dateGiven: dateGiven ? new Date(dateGiven) : null,
        nextDueDate: new Date(nextDueDate),
        batchNumber,
        manufacturer,
        dosage,
        notes,
        administeredById: req.user!.id,
        status: dateGiven ? 'COMPLETED' : 'PENDING',
      },
    });

    await prisma.activityLog.create({
      data: {
        animalId,
        actionType: 'VACCINATION',
        description: `Vaccination ${vaccineName} ${dateGiven ? 'administered' : 'scheduled'}. Next due: ${nextDueDate}`,
        performedById: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: vaccination });
  } catch (err) {
    next(err);
  }
}

// ─── Update vaccination (mark as completed) ───────────────────────────────────

export async function updateVaccination(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { dateGiven, nextDueDate, status, batchNumber, notes } = req.body;

    const updated = await prisma.vaccination.update({
      where: { id },
      data: {
        dateGiven: dateGiven ? new Date(dateGiven) : undefined,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
        status,
        batchNumber,
        notes,
        administeredById: req.user!.id,
      },
      include: { animal: { select: { customId: true, name: true } } },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Send WhatsApp vaccination reminder ──────────────────────────────────────

export async function sendVaccinationReminderManual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { phone } = req.body;

    const vaccination = await prisma.vaccination.findUnique({
      where: { id },
      include: { animal: { include: { farm: true } } },
    });

    if (!vaccination) throw createError('Vaccination not found', 404);

    const daysUntilDue = Math.ceil((vaccination.nextDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await sendVaccinationReminder(
      phone,
      vaccination.animal.customId,
      vaccination.animal.name || vaccination.animal.customId,
      vaccination.vaccineName,
      vaccination.nextDueDate,
      daysUntilDue,
      vaccination.animal.farmId
    );

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (err) {
    next(err);
  }
}

// ─── Vaccination Calendar ─────────────────────────────────────────────────────

export async function getVaccinationCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { month, year } = req.query;

    const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
    const endDate = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);

    const vaccinations = await prisma.vaccination.findMany({
      where: {
        animal: { farmId: farmId || undefined },
        nextDueDate: { gte: startDate, lte: endDate },
      },
      include: {
        animal: { select: { customId: true, name: true, breed: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    });

    // Group by date
    const calendar: Record<string, any[]> = {};
    vaccinations.forEach((v) => {
      const dateKey = v.nextDueDate.toISOString().split('T')[0];
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(v);
    });

    res.json({ success: true, data: calendar });
  } catch (err) {
    next(err);
  }
}
