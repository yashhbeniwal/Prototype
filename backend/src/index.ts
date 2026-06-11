import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './services/prisma.service';
import { startScheduler } from './services/scheduler.service';
import app from './app';

const PORT = config.PORT;

async function main(): Promise<void> {
  try {
    // Connect to the database
    await connectDatabase();

    // Start background scheduler jobs
    startScheduler();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`
🐐 ─────────────────────────────────────────────
🚀  Goat Farm ERP Backend
📡  Server running on port ${PORT}
🌏  Environment: ${config.NODE_ENV}
📚  API Docs: http://localhost:${PORT}/api/docs
🏥  Health: http://localhost:${PORT}/health
─────────────────────────────────────────────
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
