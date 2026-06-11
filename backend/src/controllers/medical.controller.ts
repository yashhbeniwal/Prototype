import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { uploadToS3 } from '../services/s3.service';
import { createError } from '../middlewares/error.middleware';

export async function listMedicalRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { animalId, isResolved, page = '1', limit = '20' } = req.query;
    const farmId = req.user!.farmId;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (animalId) where.animalId = animalId;
    if (isResolved !== undefined) where.isResolved = isResolved === 'true';
    if (farmId) where.animal = { farmId };

    const [records, total] = await Promise.all([
      prisma.medicalRecord.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { date: 'desc' },
        include: {
          animal: { select: { customId: true, name: true, breed: true } },
          veterinarian: { select: { name: true } },
        },
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    res.json({
      success: true, data: records,
      pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string), totalPages: Math.ceil(total / parseInt(limit as string)) },
    });
  } catch (err) { next(err); }
}

export async function getMedicalRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const record = await prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        animal: { select: { customId: true, name: true, breed: true, images: true } },
        veterinarian: { select: { name: true, email: true } },
      },
    });
    if (!record) throw createError('Medical record not found', 404);
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
}

export async function createMedicalRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      animalId, disease, symptoms, diagnosis, treatment,
      medicines, prescription, doctorNotes, followUpDate, treatmentCost, date,
    } = req.body;

    const animal = await prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) throw createError('Animal not found', 404);

    const record = await prisma.medicalRecord.create({
      data: {
        animalId, disease, symptoms, diagnosis, treatment,
        medicines: medicines ? JSON.parse(medicines) : null,
        prescription, doctorNotes,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        treatmentCost: treatmentCost ? parseFloat(treatmentCost) : null,
        date: date ? new Date(date) : new Date(),
        veterinarianId: req.user!.id,
      },
    });

    // Auto-create expense if treatment cost provided
    if (treatmentCost && parseFloat(treatmentCost) > 0) {
      await prisma.expense.create({
        data: {
          animalId,
          farmId: animal.farmId,
          category: 'MEDICINE',
          description: `Treatment: ${disease}`,
          amount: parseFloat(treatmentCost),
          date: date ? new Date(date) : new Date(),
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        animalId,
        actionType: 'MEDICAL_RECORD',
        description: `Medical record added: ${disease}`,
        performedById: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
}

export async function updateMedicalRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isResolved, followUpDate, doctorNotes, medicines, treatmentCost } = req.body;

    const updated = await prisma.medicalRecord.update({
      where: { id },
      data: {
        isResolved,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        doctorNotes,
        medicines: medicines ? JSON.parse(medicines) : undefined,
        treatmentCost: treatmentCost ? parseFloat(treatmentCost) : undefined,
        ...req.body,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

export async function uploadMedicalAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!req.file) throw createError('No file uploaded', 400);

    const result = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, `medical/${id}`);

    const record = await prisma.medicalRecord.findUnique({ where: { id } });
    if (!record) throw createError('Record not found', 404);

    const updated = await prisma.medicalRecord.update({
      where: { id },
      data: { attachments: [...record.attachments, result.url] },
    });

    res.json({ success: true, data: { url: result.url, record: updated } });
  } catch (err) { next(err); }
}
