import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from './prisma.service';
import { NotificationChannel, NotificationEvent, MessageStatus } from '@prisma/client';

const WA_BASE_URL = `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}`;

interface WATextMessage {
  to: string;
  body: string;
}

interface WAMediaMessage {
  to: string;
  mediaUrl: string;
  caption?: string;
  type: 'image' | 'video' | 'document';
}

interface WATemplateMessage {
  to: string;
  templateName: string;
  language?: string;
  components?: any[];
}

/**
 * Send a plain text WhatsApp message
 */
export async function sendWhatsAppText(
  to: string,
  body: string,
  farmId?: string,
  event?: NotificationEvent
): Promise<void> {
  const normalizedTo = normalizePhone(to);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedTo,
    type: 'text',
    text: { preview_url: false, body },
  };

  const logId = await createNotificationLog(
    farmId,
    NotificationChannel.WHATSAPP,
    event || NotificationEvent.ANIMAL_HEALTH_ALERT,
    normalizedTo,
    body
  );

  try {
    const res = await axios.post(
      `${WA_BASE_URL}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const externalId = res.data?.messages?.[0]?.id;
    await updateNotificationLog(logId, MessageStatus.SENT, externalId, res.data);
    logger.info(`WhatsApp message sent to ${normalizedTo}: ${externalId}`);
  } catch (err: any) {
    const errMsg = err.response?.data?.error?.message || err.message;
    await updateNotificationLog(logId, MessageStatus.FAILED, undefined, undefined, errMsg);
    logger.error(`WhatsApp send failed to ${normalizedTo}: ${errMsg}`);
    throw err;
  }
}

/**
 * Send a media (image/video/document) via WhatsApp
 */
export async function sendWhatsAppMedia(msg: WAMediaMessage): Promise<void> {
  const normalizedTo = normalizePhone(msg.to);
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedTo,
    type: msg.type,
    [msg.type]: {
      link: msg.mediaUrl,
      ...(msg.caption ? { caption: msg.caption } : {}),
    },
  };

  try {
    const res = await axios.post(
      `${WA_BASE_URL}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    logger.info(`WhatsApp media sent to ${normalizedTo}: ${res.data?.messages?.[0]?.id}`);
  } catch (err: any) {
    logger.error(`WhatsApp media send failed: ${err.response?.data?.error?.message || err.message}`);
    throw err;
  }
}

/**
 * Send a template message (for HSM / business-initiated)
 */
export async function sendWhatsAppTemplate(msg: WATemplateMessage): Promise<void> {
  const normalizedTo = normalizePhone(msg.to);
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'template',
    template: {
      name: msg.templateName,
      language: { code: msg.language || 'en_US' },
      ...(msg.components ? { components: msg.components } : {}),
    },
  };

  try {
    await axios.post(`${WA_BASE_URL}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, payload, {
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    logger.info(`WhatsApp template "${msg.templateName}" sent to ${normalizedTo}`);
  } catch (err: any) {
    logger.error(`WhatsApp template send failed: ${err.response?.data?.error?.message || err.message}`);
    throw err;
  }
}

/**
 * Handle WhatsApp status webhook (delivery receipts)
 */
export async function handleWhatsAppWebhook(body: any): Promise<void> {
  const statuses = body.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (!statuses) return;

  for (const status of statuses) {
    const { id, status: statusType, timestamp } = status;
    let newStatus: MessageStatus;

    switch (statusType) {
      case 'delivered':
        newStatus = MessageStatus.DELIVERED;
        break;
      case 'read':
        newStatus = MessageStatus.READ;
        break;
      case 'failed':
        newStatus = MessageStatus.FAILED;
        break;
      default:
        newStatus = MessageStatus.SENT;
    }

    await prisma.notificationLog.updateMany({
      where: { externalId: id },
      data: {
        status: newStatus,
        ...(newStatus === MessageStatus.DELIVERED ? { deliveredAt: new Date(Number(timestamp) * 1000) } : {}),
        ...(newStatus === MessageStatus.READ ? { readAt: new Date(Number(timestamp) * 1000) } : {}),
      },
    });
  }
}

/**
 * Send vaccination reminder via WhatsApp
 */
export async function sendVaccinationReminder(
  phone: string,
  animalId: string,
  animalName: string,
  vaccineName: string,
  dueDate: Date,
  daysUntilDue: number,
  farmId: string
): Promise<void> {
  const dateStr = dueDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const urgency = daysUntilDue === 1 ? '⚠️ URGENT' : daysUntilDue <= 7 ? '🔔 Reminder' : '📅 Upcoming';
  const message = `${urgency}: Vaccination Due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}

Animal: ${animalName || animalId}
Vaccine: ${vaccineName}
Due Date: ${dateStr}

Please schedule the vaccination immediately. Contact your veterinarian for assistance.

— Goat Farm ERP`;

  await sendWhatsAppText(phone, message, farmId, NotificationEvent.VACCINATION_DUE);
}

/**
 * Send payment reminder via WhatsApp
 */
export async function sendPaymentReminder(
  phone: string,
  customerName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: Date,
  farmId: string
): Promise<void> {
  const dateStr = dueDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const message = `💰 Payment Reminder

Dear ${customerName},

Invoice: ${invoiceNumber}
Amount Due: ₹${amount.toFixed(2)}
Due Date: ${dateStr}

Please make payment at your earliest convenience.

For UPI payment, contact us to receive a payment link.

— Goat Farm ERP`;

  await sendWhatsAppText(phone, message, farmId, NotificationEvent.PAYMENT_DUE);
}

// ─── Helpers ──────────────────────────────────────────

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, and plus signs; ensure country code
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  if (cleaned.startsWith('0')) return '91' + cleaned.slice(1);
  if (cleaned.length === 10) return '91' + cleaned;
  return cleaned;
}

async function createNotificationLog(
  farmId: string | undefined,
  channel: NotificationChannel,
  event: NotificationEvent,
  recipient: string,
  messageContent: string
): Promise<string> {
  const log = await prisma.notificationLog.create({
    data: {
      farmId,
      channel,
      event,
      recipient,
      messageContent,
      status: MessageStatus.QUEUED,
    },
  });
  return log.id;
}

async function updateNotificationLog(
  id: string,
  status: MessageStatus,
  externalId?: string,
  responsePayload?: any,
  errorMessage?: string
): Promise<void> {
  await prisma.notificationLog.update({
    where: { id },
    data: {
      status,
      ...(externalId ? { externalId } : {}),
      ...(responsePayload ? { responsePayload } : {}),
      ...(errorMessage ? { errorMessage } : {}),
      ...(status === MessageStatus.SENT ? { sentAt: new Date() } : {}),
    },
  });
}
