import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { uploadToS3 } from '../services/s3.service';
import { createError } from '../middlewares/error.middleware';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

// ─── List Animals ───────────────────────────────────────────────────────────

export async function listAnimals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.query.farmId as string;
    const { status, breed, gender, search, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { farmId };
    if (status) where.status = status;
    if (breed) where.breed = { contains: breed as string, mode: 'insensitive' };
    if (gender) where.gender = gender;
    if (search) {
      where.OR = [
        { customId: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { breed: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [animals, total] = await Promise.all([
      prisma.animal.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { customId: 'asc' },
        select: {
          id: true, customId: true, name: true, breed: true, weight: true,
          dateOfBirth: true, gender: true, color: true, status: true,
          location: true, images: true, createdAt: true,
          _count: { select: { vaccinations: true, medicalHistory: true } },
        },
      }),
      prisma.animal.count({ where }),
    ]);

    res.json({
      success: true,
      data: animals,
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

// ─── Get Animal Detail ───────────────────────────────────────────────────────

export async function getAnimal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const farmId = req.user!.farmId;

    const animal = await prisma.animal.findFirst({
      where: { id, farmId: farmId || undefined },
      include: {
        vaccinations: { orderBy: { nextDueDate: 'asc' } },
        medicalHistory: { orderBy: { date: 'desc' }, take: 10 },
        feedConsumption: {
          orderBy: { date: 'desc' },
          take: 30,
          include: { feedInventory: { select: { feedType: true } } },
        },
        weightHistory: { orderBy: { recordedAt: 'desc' }, take: 20 },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        expenses: { orderBy: { date: 'desc' }, take: 20 },
        revenues: { orderBy: { date: 'desc' }, take: 10 },
      },
    });

    if (!animal) throw createError('Animal not found', 404);

    // Calculate costing
    const totalExpenses = await prisma.expense.aggregate({
      where: { animalId: id },
      _sum: { amount: true },
    });
    const totalRevenue = await prisma.revenue.aggregate({
      where: { animalId: id },
      _sum: { amount: true },
    });
    const totalFeedCost = await prisma.feedConsumption.aggregate({
      where: { animalId: id },
      _sum: { totalCost: true },
    });

    const profitability = {
      totalExpenses: (totalExpenses._sum.amount || 0) + (totalFeedCost._sum.totalCost || 0) + (animal.purchaseCost || 0),
      totalRevenue: totalRevenue._sum.amount || 0,
      netProfit: 0,
    };
    profitability.netProfit = profitability.totalRevenue - profitability.totalExpenses;

    res.json({ success: true, data: { ...animal, profitability } });
  } catch (err) {
    next(err);
  }
}

// ─── Create Animal ───────────────────────────────────────────────────────────

export async function createAnimal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.body.farmId;
    if (!farmId) throw createError('Farm ID is required', 400);

    const {
      customId, name, breed, weight, dateOfBirth, gender, color, markings,
      purchaseDate, purchaseCost, location, motherCustomId, fatherCustomId, rfidTag,
    } = req.body;

    // Check for duplicate customId
    const existing = await prisma.animal.findUnique({ where: { customId } });
    if (existing) throw createError(`Animal with ID ${customId} already exists`, 409);

    // Generate QR code
    const qrData = JSON.stringify({ customId, farmId, type: 'goat' });
    const qrCodeUrl = await QRCode.toDataURL(qrData);

    const animal = await prisma.animal.create({
      data: {
        customId, name, breed, weight: parseFloat(weight),
        dateOfBirth: new Date(dateOfBirth),
        gender, color, markings, purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : null,
        location, motherCustomId, fatherCustomId, rfidTag, farmId, qrCodeUrl,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        animalId: animal.id,
        actionType: 'ADDED',
        description: `Animal ${customId} added to farm`,
        performedById: req.user!.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE',
        resource: 'Animal',
        resourceId: animal.id,
        details: { customId, breed },
      },
    });

    res.status(201).json({ success: true, data: animal });
  } catch (err) {
    next(err);
  }
}

// ─── Update Animal ───────────────────────────────────────────────────────────

export async function updateAnimal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const farmId = req.user!.farmId;

    const animal = await prisma.animal.findFirst({ where: { id, farmId: farmId || undefined } });
    if (!animal) throw createError('Animal not found', 404);

    const { weight, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (weight) updateData.weight = parseFloat(weight);
    if (req.body.dateOfBirth) updateData.dateOfBirth = new Date(req.body.dateOfBirth);
    if (req.body.purchaseDate) updateData.purchaseDate = new Date(req.body.purchaseDate);

    // Track weight history
    if (weight && parseFloat(weight) !== animal.weight) {
      await prisma.weightRecord.create({
        data: {
          animalId: id,
          weight: parseFloat(weight),
          notes: req.body.weightNote,
        },
      });
      await prisma.activityLog.create({
        data: {
          animalId: id,
          actionType: 'WEIGHT_UPDATE',
          description: `Weight updated from ${animal.weight}kg to ${weight}kg`,
          performedById: req.user!.id,
        },
      });
    }

    const updated = await prisma.animal.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE',
        resource: 'Animal',
        resourceId: id,
        details: { before: animal, after: updateData },
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Archive / Transfer ──────────────────────────────────────────────────────

export async function archiveAnimal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const animal = await prisma.animal.update({
      where: { id },
      data: { status: status || 'SOLD' },
    });

    await prisma.activityLog.create({
      data: {
        animalId: id,
        actionType: 'STATUS_CHANGE',
        description: `Status changed to ${status}. Reason: ${reason || 'N/A'}`,
        performedById: req.user!.id,
      },
    });

    res.json({ success: true, data: animal });
  } catch (err) {
    next(err);
  }
}

export async function transferAnimal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { toFarmId, reason } = req.body;

    if (!toFarmId) throw createError('Target farm ID is required', 400);

    const animal = await prisma.animal.update({
      where: { id },
      data: { farmId: toFarmId, status: 'ACTIVE' },
    });

    await prisma.activityLog.create({
      data: {
        animalId: id,
        actionType: 'TRANSFER',
        description: `Transferred to farm ${toFarmId}. Reason: ${reason || 'N/A'}`,
        performedById: req.user!.id,
        metadata: { fromFarmId: req.user!.farmId, toFarmId },
      },
    });

    res.json({ success: true, data: animal });
  } catch (err) {
    next(err);
  }
}

// ─── Upload Images/Videos ────────────────────────────────────────────────────

export async function uploadAnimalMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { mediaType = 'images' } = req.query;

    if (!req.file) throw createError('No file uploaded', 400);

    const result = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      `animals/${id}`
    );

    const animal = await prisma.animal.findUnique({ where: { id } });
    if (!animal) throw createError('Animal not found', 404);

    const currentMedia = mediaType === 'videos' ? animal.videos : animal.images;
    const updated = await prisma.animal.update({
      where: { id },
      data: { [mediaType as string]: [...currentMedia, result.url] },
    });

    res.json({ success: true, data: { url: result.url, animal: updated } });
  } catch (err) {
    next(err);
  }
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getAnimalStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.query.farmId as string;

    const [
      totalActive, totalByStatus, totalByBreed, totalByGender,
      recentlyAdded, vaccinationsDue,
    ] = await Promise.all([
      prisma.animal.count({ where: { farmId, status: 'ACTIVE' } }),
      prisma.animal.groupBy({ by: ['status'], where: { farmId }, _count: true }),
      prisma.animal.groupBy({ by: ['breed'], where: { farmId, status: 'ACTIVE' }, _count: true, orderBy: { _count: { breed: 'desc' } } }),
      prisma.animal.groupBy({ by: ['gender'], where: { farmId, status: 'ACTIVE' }, _count: true }),
      prisma.animal.count({ where: { farmId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.vaccination.count({
        where: {
          animal: { farmId },
          status: { in: ['PENDING', 'OVERDUE'] },
          nextDueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        byStatus: totalByStatus,
        byBreed: totalByBreed,
        byGender: totalByGender,
        recentlyAdded,
        vaccinationsDueThisWeek: vaccinationsDue,
      },
    });
  } catch (err) {
    next(err);
  }
}
