import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadConfig } from './core/config/config.service';
import { createPino, PinoNestLogger } from './core/logging/pino.logger';

async function main() {
  const config = loadConfig();
  const logger = new PinoNestLogger(createPino(config.LOG_LEVEL));
  // rawBody is needed to verify webhook signatures (Meta, Chargily, couriers)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger, rawBody: true, bodyParser: true });
  app.useBodyParser('json', { limit: '2mb' });
  configureApp(app);
  await app.listen(config.PORT);
  logger.log(`API listening on :${config.PORT}`, 'bootstrap');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
