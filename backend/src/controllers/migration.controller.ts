import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { parseExcelFile, parseCSVString } from '../utils/excel.util';
import { logger } from '../utils/logger';

export async function uploadMigrationFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId || req.body.farmId;
    if (!req.file) {
      res.status(400).json({ success: false, message: 'File required' });
      return;
    }

    const { type = 'EXCEL' } = req.body;
    const fileName = req.file.originalname;

    // Create migration job record
    const job = await prisma.migrationJob.create({
      data: {
        farmId,
        fileName,
        fileUrl: '',
        type: type as string,
        status: 'PROCESSING',
        uploadedById: req.user!.id,
      },
    });

    // Process asynchronously
    processMigration(job.id, req.file.buffer, type, farmId, fileName).catch((err) => {
      logger.error(`Migration job ${job.id} failed: ${err.message}`);
    });

    res.status(202).json({
      success: true,
      message: 'Migration job started',
      data: { jobId: job.id },
    });
  } catch (err) {
    next(err);
  }
}

async function processMigration(
  jobId: string,
  buffer: Buffer,
  type: string,
  farmId: string,
  fileName: string
): Promise<void> {
  let rows: Record<string, any>[] = [];

  try {
    if (type === 'CSV') {
      rows = parseCSVString(buffer.toString('utf-8'));
    } else {
      rows = parseExcelFile(buffer);
    }

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { totalRows: rows.length },
    });

    let processed = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Try to map row to animal
        if (row['Animal ID'] || row['customId']) {
          const customId = String(row['Animal ID'] || row['customId']).trim();
          const breed = String(row['Breed'] || row['breed'] || 'Unknown').trim();
          const weight = parseFloat(row['Weight'] || row['weight'] || '0');
          const gender = String(row['Gender'] || row['gender'] || 'FEMALE').toUpperCase();
          const dateOfBirth = row['DOB'] || row['dateOfBirth'] ? new Date(row['DOB'] || row['dateOfBirth']) : new Date();

          const existing = await prisma.animal.findUnique({ where: { customId } });
          if (!existing) {
            await prisma.animal.create({
              data: {
                customId,
                breed,
                weight,
                gender: gender === 'MALE' ? 'MALE' : 'FEMALE',
                dateOfBirth,
                farmId,
                name: row['Name'] || row['name'] || null,
                color: row['Color'] || row['color'] || null,
                location: row['Location'] || row['location'] || null,
                purchaseCost: row['Purchase Cost'] ? parseFloat(row['Purchase Cost']) : null,
                status: 'ACTIVE',
              },
            });
          }
        }
        processed++;
      } catch (err: any) {
        errors.push({ row: i + 2, message: err.message });
      }
    }

    await prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: errors.length > 0 && processed === 0 ? 'FAILED' : 'COMPLETED',
        processedRows: processed,
        errorRows: errors.length,
        errors: errors as any,
      },
    });

    logger.info(`Migration job ${jobId} completed: ${processed}/${rows.length} rows processed`);
  } catch (err: any) {
    await prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errors: [{ message: err.message }] as any },
    });
  }
}

export async function listMigrationJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const farmId = req.user!.farmId;
    const jobs = await prisma.migrationJob.findMany({
      where: { farmId: farmId || undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
}

export async function getMigrationJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const job = await prisma.migrationJob.findUnique({ where: { id } });
    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}
