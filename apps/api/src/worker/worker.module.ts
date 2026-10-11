import { Module } from '@nestjs/common';
import { FEATURE_MODULES } from '../app.module';
import { CoreModule } from '../core/core.module';
import { OutboxRelay } from './outbox.relay';
import { WorkerRunner } from './worker.runner';

/** Worker process = the same feature modules (their processors and schedulers) without the HTTP layer. */
@Module({
  imports: [CoreModule, ...FEATURE_MODULES],
  providers: [OutboxRelay, WorkerRunner],
  exports: [OutboxRelay, WorkerRunner],
})
export class WorkerModule {}
