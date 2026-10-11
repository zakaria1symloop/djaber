// One Nest application per test file, built with the exact production pipeline (bootstrap.ts).
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { rawPrisma } from '@djaber/db';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import type { RedisIoAdapter } from '../../src/core/ws/redis-io.adapter';

export type TestApp = { app: INestApplication; http: () => any; close: () => Promise<void> };

export const createTestApp = async (extra: { controllers?: any[]; providers?: any[] } = {}): Promise<TestApp> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extra.controllers ?? [],
    providers: extra.providers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: false });
  const adapter: RedisIoAdapter = configureApp(app);
  await app.init();
  return {
    app,
    http: () => app.getHttpServer(),
    close: async () => {
      await app.close();
      await adapter.close();
      await rawPrisma.$disconnect();
    },
  };
};
