// Shared by main.ts and the integration tests so both run the exact same HTTP pipeline.
import { RequestMethod, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from './core/config/config.service';
import { RedisIoAdapter } from './core/ws/redis-io.adapter';

/**
 * V1 paths registered in the Meta app (webhook, OAuth return, data deletion), rewritten to their V2 routes before
 * routing so the same public host keeps working after the cutover without touching the Meta settings. The raw body is
 * captured by the body parser, not by the path, so webhook signatures still verify.
 */
const LEGACY_META: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/api\/webhooks\/meta\/data-deletion\/?(\?.*)?$/, (m) => `/api/v1/webhooks/meta/data-deletion${m[1] ?? ''}`],
  [/^\/api\/webhooks\/meta\/?(\?.*)?$/, (m) => `/api/v1/webhooks/meta${m[1] ?? ''}`],
  [/^\/api\/pages\/callback\/(facebook|instagram)\/?(\?.*)?$/, (m) => `/api/v1/channels/callback/${m[1]}${m[2] ?? ''}`],
];
export const legacyMetaPaths = (req: { url: string }, _res: unknown, next: () => void) => {
  for (const [re, to] of LEGACY_META) {
    const m = req.url.match(re);
    if (m) {
      req.url = to(m);
      break;
    }
  }
  next();
};

export const configureApp = (app: INestApplication) => {
  const config = app.get(ConfigService);
  const express = app as NestExpressApplication;
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  if (config.get('META_LEGACY_PATHS')) app.use(legacyMetaPaths);
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      // API-04: published documentation outside the versioned base path
      { path: 'api/docs', method: RequestMethod.GET },
      { path: 'api/docs/openapi.json', method: RequestMethod.GET },
      { path: 'api/docs/postman.json', method: RequestMethod.GET },
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
