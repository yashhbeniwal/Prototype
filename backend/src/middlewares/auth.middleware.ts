import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../services/prisma.service';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  farmId: string | null;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * JWT authentication middleware — validates Bearer token
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, farmId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User not found or deactivated' });
      return;
    }

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, farmId: user.farmId };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
}

/**
 * Role-based authorization middleware — allow specific roles
 */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication — continues even if no token
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, farmId: true, isActive: true },
    });
    if (user?.isActive) {
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role, farmId: user.farmId };
    }
  } catch {
    // Ignore token errors in optional auth
  }
  next();
}
