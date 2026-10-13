// Entry used by apps/worker (`require('@djaber/api/worker/bootstrap').startWorker()`).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { loadConfig } from '../core/config/config.service';
import { createPino, PinoNestLogger } from '../core/logging/pino.logger';
import { MetricsService } from '../core/metrics/metrics.service';
import { RedisService } from '../core/redis/redis.provider';
import { WORKERS_KEY } from '../modules/admin-ops/health/jobs-health.service';
import { isPrivateIp } from '../modules/admin-ops/health/health.controllers';
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
  const metrics = app.get(MetricsService);
  createServer((req, res) => {
    // Prometheus scrape of the worker (07-non-functional §5): internal network only, or the METRICS_TOKEN bearer
    if (req.url?.split('?')[0] === '/metrics') {
      const allowed = config.METRICS_TOKEN ? req.headers.authorization === `Bearer ${config.METRICS_TOKEN}` : isPrivateIp(req.socket.remoteAddress);
      if (!allowed) {
        res.statusCode = 403;
        res.end();
        return;
      }
      void metrics.text().then((text) => {
        res.setHeader('Content-Type', metrics.contentType);
        res.end(text);
      });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', svc: 'worker', uptime: Math.round(process.uptime()) }));
  }).listen(port);
  // ADM-14 "workers": heartbeat every 30 s (host:pid → last beat)
  const redis = app.get(RedisService);
  const host = `${hostname()}:${process.pid}`;
  const beat = () => redis.client.hset(WORKERS_KEY, host, new Date().toISOString()).catch(() => undefined);
  void beat();
  setInterval(beat, 30_000).unref();
  logger.log(`worker connected (health on :${port})`, 'bootstrap');
  return app;
}
