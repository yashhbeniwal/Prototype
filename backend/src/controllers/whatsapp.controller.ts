import { Request, Response } from 'express';
import { config } from '../config';
import { handleWhatsAppWebhook } from '../services/whatsapp.service';
import { handleTelegramWebhook } from '../services/telegram.service';
import { logger } from '../utils/logger';

// ─── WhatsApp Webhook Verify ──────────────────────────────────────────────────

export async function verifyWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ success: false, message: 'Verification failed' });
  }
}

export async function handleWhatsAppStatus(req: Request, res: Response): Promise<void> {
  try {
    await handleWhatsAppWebhook(req.body);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('WhatsApp webhook error:', err);
    res.status(200).json({ received: true }); // Always 200 to Meta
  }
}

// ─── Telegram Webhook ─────────────────────────────────────────────────────────

export async function verifyTelegramWebhook(req: Request, res: Response): Promise<void> {
  res.json({ success: true, message: 'Telegram webhook active' });
}

export async function handleTelegramUpdate(req: Request, res: Response): Promise<void> {
  try {
    await handleTelegramWebhook(req.body);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Telegram webhook error:', err);
    res.status(200).json({ received: true });
  }
}
