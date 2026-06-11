import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Default API rate limiter: 100 requests per 15 minutes per IP
 */
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

/**
 * Strict limiter for auth endpoints: 10 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

/**
 * Stricter limiter for voice query endpoints: 30 per minute
 */
export const voiceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Voice query rate limit exceeded. Please wait a moment.' },
});
