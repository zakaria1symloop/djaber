import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth-core.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import {
  AdminAiController,
  AdminAuditController,
  AdminBillingCatalogController,
  AdminCmsController,
  AdminOverviewController,
  AdminPresetsController,
  AdminUsersController,
  AdminViewersController,
  AdminWorkspacesController,
} from './admin-core.controllers';
import { AdminJobsService } from './admin-jobs.service';
import { AiAdminService } from './ai-admin.service';
import { AuditQueryService } from './audit-query.service';
import { AdminBillingCatalogService } from './billing-admin.service';
import { CmsAdminService } from './cms.service';
import { AdminOverviewService } from './overview.service';
import { PresetAdminService } from './presets.service';
import { AdminUsersService } from './users.service';
import { AdminViewersService } from './viewers.service';
import { AdminWorkspacesService } from './workspaces.service';

/**
 * 01-nest-module-map `admin` — the platform admin core of M10 (api-a): ADM-01 overview, ADM-02 workspaces, ADM-03 users,
 * ADM-04 plans, ADM-05 subscriptions & invoices, ADM-06 AI, ADM-07 presets, ADM-08 CMS, ADM-09 audit, ADM-15 packs & promo
 * codes, ADM-16 team & deletion requests, ADM-17 viewers + read-only impersonation. The ops & safety areas live in `admin-ops`.
 */
@Module({
  imports: [AuthCoreModule, AuthModule, WorkspaceModule, BillingModule, ChannelsModule],
  controllers: [AdminOverviewController, AdminWorkspacesController, AdminUsersController, AdminBillingCatalogController, AdminAiController, AdminPresetsController, AdminCmsController, AdminAuditController, AdminViewersController],
  providers: [AdminJobsService, AdminOverviewService, AdminWorkspacesService, AdminUsersService, AdminBillingCatalogService, AiAdminService, PresetAdminService, CmsAdminService, AuditQueryService, AdminViewersService],
  exports: [AdminJobsService, AdminOverviewService],
})
export class AdminCoreModule {}
