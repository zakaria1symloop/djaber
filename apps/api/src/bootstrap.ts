// Shared by main.ts and the integration tests so both run the exact same HTTP pipeline.
import { RequestMethod, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from './core/config/config.service';
import { RedisIoAdapter } from './core/ws/redis-io.adapter';

export const configureApp = (app: INestApplication) => {
  const config = app.get(ConfigService);
  const express = app as NestExpressApplication;
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigins,
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'Idempotent-Replayed'],
  });
  const adapter = new RedisIoAdapter(app, config.get('REDIS_URL'), config.webOrigins);
  app.useWebSocketAdapter(adapter);
  app.enableShutdownHooks();
  return adapter;
};
