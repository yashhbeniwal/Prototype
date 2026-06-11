import Razorpay from 'razorpay';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID || '',
  key_secret: config.RAZORPAY_KEY_SECRET || '',
});

// ─────────────────────────────────────────────────────
// Razorpay Order & Payment
// ─────────────────────────────────────────────────────

export interface RazorpayOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  key: string;
}

/**
 * Create a Razorpay order for an invoice
 */
export async function createRazorpayOrder(
  amount: number,
  invoiceId: string,
  notes?: Record<string, string>
): Promise<RazorpayOrderResult> {
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // Razorpay uses paise
    currency: 'INR',
    receipt: `invoice_${invoiceId}`,
    notes: notes || {},
  });

  logger.info(`Razorpay order created: ${order.id} for invoice ${invoiceId}`);
  return {
    orderId: order.id,
    amount,
    currency: 'INR',
    key: config.RAZORPAY_KEY_ID || '',
  };
}

/**
 * Verify Razorpay payment signature (webhook validation)
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyRazorpayWebhook(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

// ─────────────────────────────────────────────────────
// UPI Payment Link & QR Code
// ─────────────────────────────────────────────────────

export interface UPIPaymentData {
  upiLink: string;
  qrCodeBase64: string;
  qrCodeDataUrl: string;
}

/**
 * Generate a UPI payment link and QR code for an invoice
 */
export async function generateUPIPayment(
  upiId: string,
  payeeName: string,
  amount: number,
  invoiceNumber: string
): Promise<UPIPaymentData> {
  // UPI deep link format
  const upiLink = buildUPILink(upiId, payeeName, amount, invoiceNumber);

  // Generate QR code as base64 PNG
  const qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  const qrCodeBase64 = qrCodeDataUrl.replace('data:image/png;base64,', '');

  return { upiLink, qrCodeBase64, qrCodeDataUrl };
}

/**
 * Build a standard UPI intent link
 */
function buildUPILink(
  upiId: string,
  payeeName: string,
  amount: number,
  transactionNote: string
): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    tn: transactionNote,
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Generate a QR code from any string/URL
 */
export async function generateQRCode(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
