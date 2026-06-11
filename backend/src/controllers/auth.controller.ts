import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.service';
import { config } from '../config';
import { createError } from '../middlewares/error.middleware';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ sub: userId, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as any,
  });
  const refreshToken = jwt.sign({ sub: userId }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as any,
  });
  return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError('Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw createError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Log failed login
      await prisma.loginHistory.create({
        data: { userId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'], successful: false, failReason: 'INVALID_PASSWORD' },
      });
      throw createError('Invalid credentials', 401);
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Log successful login
    await Promise.all([
      prisma.loginHistory.create({
        data: { userId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'], successful: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          resource: 'User',
          resourceId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: { email: user.email, role: user.role },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, farmId: user.farmId },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/register
 * Only SUPERADMIN or OWNER can create new users
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, name, role, farmId, phone, whatsappNumber } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw createError('User with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: role || 'WORKER', farmId, phone, whatsappNumber },
    });

    logger.info(`New user created: ${user.email} (${user.role})`);

    res.status(201).json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role, farmId: user.farmId },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw createError('Refresh token required', 400);

    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as any;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw createError('Invalid refresh token', 401);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, name: true, role: true, farmId: true,
        phone: true, whatsappNumber: true, profileImageUrl: true, lastLogin: true,
        farm: { select: { id: true, name: true, code: true, location: true } },
      },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/auth/change-password
 */
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw createError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw createError('Current password is incorrect', 400);

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
