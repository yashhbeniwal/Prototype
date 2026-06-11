import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error(`${req.method} ${req.path} - ${statusCode}: ${err.message}`, {
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Create an operational AppError
 */
export function createError(message: string, statusCode: number = 500): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
