import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MessagingModule } from '../messaging/messaging.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DashboardController } from './dashboard.controller';
import { HomeService } from './home.service';

/** 01-nest-module-map `analytics` — M5 part: the Home dashboard (ANA-01). Overview + tabs + DailyStat arrive with M8. */
@Module({ imports: [CatalogModule, MessagingModule, WorkspaceModule], controllers: [DashboardController], providers: [HomeService], exports: [HomeService] })
export class DashboardModule {}
