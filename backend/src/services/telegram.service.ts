import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from './prisma.service';
import { NotificationChannel, NotificationEvent, MessageStatus } from '@prisma/client';

const TG_BASE = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;

/**
 * Send a text message to a Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  farmId?: string,
  event?: NotificationEvent
): Promise<void> {
  const log = await prisma.notificationLog.create({
    data: {
      farmId,
      channel: NotificationChannel.TELEGRAM,
      event: event || NotificationEvent.ANIMAL_HEALTH_ALERT,
      recipient: chatId,
      messageContent: text,
      status: MessageStatus.QUEUED,
    },
  });

  try {
    const res = await axios.post(`${TG_BASE}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: MessageStatus.SENT,
        externalId: String(res.data?.result?.message_id),
        sentAt: new Date(),
        responsePayload: res.data,
      },
    });

    logger.info(`Telegram message sent to chat ${chatId}`);
  } catch (err: any) {
    const errMsg = err.response?.data?.description || err.message;
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: MessageStatus.FAILED, errorMessage: errMsg },
    });
    logger.error(`Telegram message failed: ${errMsg}`);
    throw err;
  }
}

/**
 * Send a document/file via Telegram
 */
export async function sendTelegramDocument(
  chatId: string,
  documentUrl: string,
  caption?: string
): Promise<void> {
  try {
    await axios.post(`${TG_BASE}/sendDocument`, {
      chat_id: chatId,
      document: documentUrl,
      caption,
    });
    logger.info(`Telegram document sent to chat ${chatId}`);
  } catch (err: any) {
    logger.error(`Telegram document send failed: ${err.response?.data?.description || err.message}`);
    throw err;
  }
}

/**
 * Handle incoming Telegram webhook updates
 */
export async function handleTelegramWebhook(update: any): Promise<void> {
  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const text = message.text || '';

  logger.info(`Telegram incoming message from ${chatId}: ${text}`);
  // For now, just acknowledge. Full bot command handling would be implemented here.
}

/**
 * Set Telegram webhook URL
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<void> {
  const res = await axios.post(`${TG_BASE}/setWebhook`, { url: webhookUrl });
  logger.info(`Telegram webhook set: ${JSON.stringify(res.data)}`);
}
