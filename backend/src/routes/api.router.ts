import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { authRateLimiter, defaultRateLimiter, voiceRateLimiter } from '../middlewares/rate-limiter.middleware';

// ─── Import Controllers ───────────────────────────────────────────────────────
import * as auth from '../controllers/auth.controller';
import * as animal from '../controllers/animal.controller';
import * as vaccination from '../controllers/vaccination.controller';
import * as medical from '../controllers/medical.controller';
import * as feed from '../controllers/feed.controller';
import * as customer from '../controllers/customer.controller';
import * as billing from '../controllers/billing.controller';
import * as voice from '../controllers/voice.controller';
import * as report from '../controllers/report.controller';
import * as whatsappCtrl from '../controllers/whatsapp.controller';
import * as migrationCtrl from '../controllers/migration.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

// ─── Auth Routes ──────────────────────────────────────────────────────────────
router.post('/auth/login', authRateLimiter, auth.login);
router.post('/auth/register', authenticate, authorize('SUPERADMIN', 'OWNER'), auth.register);
router.post('/auth/refresh', auth.refreshToken);
router.get('/auth/me', authenticate, auth.getMe);
router.patch('/auth/change-password', authenticate, auth.changePassword);

// ─── Animal Routes ────────────────────────────────────────────────────────────
router.get('/animals', authenticate, defaultRateLimiter, animal.listAnimals);
router.get('/animals/stats', authenticate, animal.getAnimalStats);
router.get('/animals/:id', authenticate, animal.getAnimal);
router.post('/animals', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER'), animal.createAnimal);
router.patch('/animals/:id', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER'), animal.updateAnimal);
router.patch('/animals/:id/archive', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER'), animal.archiveAnimal);
router.patch('/animals/:id/transfer', authenticate, authorize('SUPERADMIN', 'OWNER'), animal.transferAnimal);
router.post('/animals/:id/media', authenticate, upload.single('file'), animal.uploadAnimalMedia);

// ─── Vaccination Routes ───────────────────────────────────────────────────────
router.get('/vaccinations', authenticate, vaccination.listVaccinations);
router.get('/vaccinations/due', authenticate, vaccination.getDueVaccinations);
router.get('/vaccinations/calendar', authenticate, vaccination.getVaccinationCalendar);
router.post('/vaccinations', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'VETERINARIAN'), vaccination.createVaccination);
router.patch('/vaccinations/:id', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'VETERINARIAN'), vaccination.updateVaccination);
router.post('/vaccinations/:id/remind', authenticate, vaccination.sendVaccinationReminderManual);

// ─── Medical History Routes ───────────────────────────────────────────────────
router.get('/medical', authenticate, medical.listMedicalRecords);
router.get('/medical/:id', authenticate, medical.getMedicalRecord);
router.post('/medical', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'VETERINARIAN'), medical.createMedicalRecord);
router.patch('/medical/:id', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'VETERINARIAN'), medical.updateMedicalRecord);
router.post('/medical/:id/attachments', authenticate, upload.single('file'), medical.uploadMedicalAttachment);

// ─── Feed Management Routes ───────────────────────────────────────────────────
router.get('/feed/inventory', authenticate, feed.listFeedInventory);
router.post('/feed/inventory', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER'), feed.createFeedInventory);
router.patch('/feed/inventory/:id', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER'), feed.updateFeedInventory);
router.get('/feed/consumption', authenticate, feed.listFeedConsumption);
router.post('/feed/consumption', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'WORKER'), feed.recordFeedConsumption);
router.get('/feed/cost-report', authenticate, feed.getFeedCostReport);

// ─── Customer Routes ──────────────────────────────────────────────────────────
router.get('/customers', authenticate, customer.listCustomers);
router.get('/customers/top-debtors', authenticate, customer.getTopDebtors);
router.get('/customers/:id', authenticate, customer.getCustomer);
router.get('/customers/:id/ledger', authenticate, customer.getCustomerLedger);
router.post('/customers', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'ACCOUNTANT'), customer.createCustomer);
router.patch('/customers/:id', authenticate, authorize('SUPERADMIN', 'OWNER', 'MANAGER', 'ACCOUNTANT'), customer.updateCustomer);

// ─── Billing Routes ───────────────────────────────────────────────────────────
router.get('/billing/invoices', authenticate, billing.listInvoices);
router.get('/billing/dashboard', authenticate, billing.getBillingDashboard);
router.get('/billing/invoices/:id', authenticate, billing.getInvoice);
router.get('/billing/invoices/:id/pdf', authenticate, billing.generateInvoicePDFEndpoint);
router.post('/billing/invoices', authenticate, authorize('SUPERADMIN', 'OWNER', 'ACCOUNTANT'), billing.createInvoice);
router.post('/billing/payments', authenticate, authorize('SUPERADMIN', 'OWNER', 'ACCOUNTANT'), billing.recordPayment);
router.post('/billing/razorpay/order', authenticate, billing.createRazorpayOrderEndpoint);
router.post('/billing/razorpay/webhook', billing.razorpayWebhookHandler); // No auth — webhook

// ─── Voice Assistant Routes ───────────────────────────────────────────────────
router.post('/voice/query', authenticate, authorize('SUPERADMIN', 'OWNER'), voiceRateLimiter, upload.single('audio'), voice.handleVoiceQuery);
router.post('/voice/transcribe', authenticate, voiceRateLimiter, upload.single('audio'), voice.transcribeOnly);

// ─── Reports Routes ───────────────────────────────────────────────────────────
router.get('/reports/animals', authenticate, report.getAnimalReport);
router.get('/reports/vaccinations', authenticate, report.getVaccinationReport);
router.get('/reports/customers/outstanding', authenticate, report.getCustomerOutstandingReport);
router.get('/reports/profitability', authenticate, authorize('SUPERADMIN', 'OWNER', 'ACCOUNTANT'), report.getProfitabilityReport);

// ─── WhatsApp Webhook Routes ──────────────────────────────────────────────────
router.get('/webhooks/whatsapp', whatsappCtrl.verifyWhatsAppWebhook);
router.post('/webhooks/whatsapp', whatsappCtrl.handleWhatsAppStatus);
router.get('/webhooks/telegram', whatsappCtrl.verifyTelegramWebhook);
router.post('/webhooks/telegram', whatsappCtrl.handleTelegramUpdate);

// ─── Data Migration Routes ────────────────────────────────────────────────────
router.post('/migration/upload', authenticate, authorize('SUPERADMIN', 'OWNER'), upload.single('file'), migrationCtrl.uploadMigrationFile);
router.get('/migration/jobs', authenticate, migrationCtrl.listMigrationJobs);
router.get('/migration/jobs/:id', authenticate, migrationCtrl.getMigrationJob);

// ─── Audit & Admin Routes ─────────────────────────────────────────────────────
router.get('/audit/logs', authenticate, authorize('SUPERADMIN', 'OWNER'), async (req, res, next) => {
  try {
    const { prisma } = await import('../services/prisma.service');
    const { page = '1', limit = '50', action, resource } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const where: any = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: logs, pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (err) { next(err); }
});

// ─── Farm Management ──────────────────────────────────────────────────────────
router.get('/farms', authenticate, authorize('SUPERADMIN'), async (req, res, next) => {
  try {
    const { prisma } = await import('../services/prisma.service');
    const farms = await prisma.farm.findMany({
      include: { _count: { select: { animals: true, users: true } } },
    });
    res.json({ success: true, data: farms });
  } catch (err) { next(err); }
});

router.post('/farms', authenticate, authorize('SUPERADMIN'), async (req, res, next) => {
  try {
    const { prisma } = await import('../services/prisma.service');
    const farm = await prisma.farm.create({ data: req.body });
    res.status(201).json({ success: true, data: farm });
  } catch (err) { next(err); }
});

router.patch('/farms/:id', authenticate, authorize('SUPERADMIN', 'OWNER'), async (req, res, next) => {
  try {
    const { prisma } = await import('../services/prisma.service');
    const farm = await prisma.farm.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: farm });
  } catch (err) { next(err); }
});

export default router;
