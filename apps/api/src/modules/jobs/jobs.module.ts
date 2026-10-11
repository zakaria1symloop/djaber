import { Global, Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { JobService } from './job.service';
import { JobsController } from './jobs.controller';

/** 01-nest-module-map `jobs`: `Job` rows + progress + WS, the generic export job, CSV / XLSX readers and writers. */
@Global()
@Module({ controllers: [JobsController], providers: [JobService, ExportService], exports: [JobService, ExportService] })
export class JobsModule {}
