// Entry used by apps/worker (`require('@djaber/api/worker/bootstrap').startWorker()`).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'node:http';
import { loadConfig } from '../core/config/config.service';
import { createPino, PinoNestLogger } from '../core/logging/pino.logger';
import { OutboxRelay } from './outbox.relay';
import { WorkerModule } from './worker.module';
import { WorkerRunner } from './worker.runner';

export async function startWorker() {
  process.env.SVC_NAME = 'worker';
  const config = loadConfig();
  const logger = new PinoNestLogger(createPino(config.LOG_LEVEL));
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger });
  app.enableShutdownHooks();
  await app.get(WorkerRunner).start();
  app.get(OutboxRelay).start();
  // liveness probe for the orchestrator
  const port = Number(process.env.WORKER_PORT ?? 4011);
  createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', svc: 'worker', uptime: Math.round(process.uptime()) }));
  }).listen(port);
  logger.log(`worker connected (health on :${port})`, 'bootstrap');
  return app;
}
