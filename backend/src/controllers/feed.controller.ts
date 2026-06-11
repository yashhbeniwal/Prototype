import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { createError } from '../middlewares/error.middleware';

// ─── Feed Inventory ───────────────────────────────────────────────────────────

export async function listFeedInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.query.farmId as string;
    const inventory = await prisma.feedInventory.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });

    // Add low stock flag
    const enriched = inventory.map((item) => ({
      ...item,
      isLowStock: item.availableStock <= item.minimumThreshold,
      daysOfStock: item.availableStock > 0 ? Math.round(item.availableStock / Math.max(1, item.minimumThreshold / 30)) : 0,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
}

export async function createFeedInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.body.farmId;
    const { feedType, supplier, quantityPurchased, cost, minimumThreshold, purchaseDate, expiryDate, batchNumber } = req.body;

    const qty = parseFloat(quantityPurchased);
    const totalCost = parseFloat(cost);

    const inventory = await prisma.feedInventory.create({
      data: {
        farmId,
        feedType,
        supplier,
        quantityPurchased: qty,
        cost: totalCost,
        costPerKg: totalCost / qty,
        availableStock: qty,
        minimumThreshold: minimumThreshold ? parseFloat(minimumThreshold) : 50,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        batchNumber,
      },
    });

    // Record as farm expense
    await prisma.expense.create({
      data: {
        farmId,
        category: 'FEED',
        description: `Feed purchase: ${feedType} (${qty}kg)`,
        amount: totalCost,
        date: purchaseDate ? new Date(purchaseDate) : new Date(),
      },
    });

    res.status(201).json({ success: true, data: inventory });
  } catch (err) { next(err); }
}

export async function updateFeedInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await prisma.feedInventory.update({
      where: { id },
      data: { ...req.body },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

// ─── Feed Consumption ─────────────────────────────────────────────────────────

export async function listFeedConsumption(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { animalId, feedInventoryId, from, to, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (animalId) where.animalId = animalId;
    if (feedInventoryId) where.feedInventoryId = feedInventoryId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }

    const [records, total] = await Promise.all([
      prisma.feedConsumption.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { date: 'desc' },
        include: {
          animal: { select: { customId: true, name: true, breed: true } },
          feedInventory: { select: { feedType: true } },
        },
      }),
      prisma.feedConsumption.count({ where }),
    ]);

    res.json({
      success: true, data: records,
      pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string), totalPages: Math.ceil(total / parseInt(limit as string)) },
    });
  } catch (err) { next(err); }
}

export async function recordFeedConsumption(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { animalId, feedInventoryId, quantity, date } = req.body;
    const qty = parseFloat(quantity);

    const inventory = await prisma.feedInventory.findUnique({ where: { id: feedInventoryId } });
    if (!inventory) throw createError('Feed inventory not found', 404);

    if (inventory.availableStock < qty) {
      throw createError(`Insufficient stock. Available: ${inventory.availableStock}kg`, 400);
    }

    const totalCost = qty * inventory.costPerKg;

    const [consumption] = await prisma.$transaction([
      prisma.feedConsumption.create({
        data: {
          animalId, feedInventoryId, quantity: qty,
          date: date ? new Date(date) : new Date(),
          costAtTime: inventory.costPerKg,
          totalCost,
          recordedById: req.user!.id,
        },
      }),
      prisma.feedInventory.update({
        where: { id: feedInventoryId },
        data: { availableStock: { decrement: qty } },
      }),
      prisma.expense.create({
        data: {
          animalId,
          farmId: inventory.farmId,
          category: 'FEED',
          description: `Feed consumption: ${inventory.feedType} (${qty}kg)`,
          amount: totalCost,
          date: date ? new Date(date) : new Date(),
        },
      }),
    ]);

    res.status(201).json({ success: true, data: consumption });
  } catch (err) { next(err); }
}

// ─── Feed Cost Reports ────────────────────────────────────────────────────────

export async function getFeedCostReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const { from, to } = req.query;

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    // Cost per animal
    const perAnimal = await prisma.feedConsumption.groupBy({
      by: ['animalId'],
      where: { animal: { farmId: farmId || undefined }, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
      _sum: { totalCost: true, quantity: true },
      orderBy: { _sum: { totalCost: 'desc' } },
    });

    // Total per feed type
    const perFeedType = await prisma.feedConsumption.groupBy({
      by: ['feedInventoryId'],
      where: { animal: { farmId: farmId || undefined }, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
      _sum: { totalCost: true, quantity: true },
    });

    // Monthly totals
    const monthlyTotal = await prisma.feedConsumption.aggregate({
      where: {
        animal: { farmId: farmId || undefined },
        date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { totalCost: true },
    });

    res.json({
      success: true,
      data: {
        perAnimal,
        perFeedType,
        currentMonthTotal: monthlyTotal._sum.totalCost || 0,
      },
    });
  } catch (err) { next(err); }
}
