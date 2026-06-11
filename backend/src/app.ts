import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import apiRouter from './routes/api.router';

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.debug(`→ ${req.method} ${req.path}`);
  res.on('finish', () => {
    logger.debug(`← ${req.method} ${req.path} [${res.statusCode}]`);
  });
  next();
});

// ─── Swagger Documentation ────────────────────────────────────────────────────
const swaggerOptions: swaggerJsDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Goat Farm ERP API',
      version: '1.0.0',
      description: 'Production-ready API for Goat Farm Management ERP SaaS Platform. All data is stored in India (AWS Mumbai Region).',
      contact: { name: 'Farm ERP Support', email: 'support@goatfarmerp.in' },
    },
    servers: [
      { url: '/api/v1', description: 'Version 1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Goat Farm ERP API',
  customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
}));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'goat-farm-erp-backend',
    version: '1.0.0',
    region: 'ap-south-1',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
