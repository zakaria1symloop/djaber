// ADM-10 — `/admin/moderation/*` + `POST /admin/workspaces/:id/trust-level` (06 §8.11, §9: read every platform role,
// write moderator + super_admin).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import {
  AdminAppealsQuerySchema,
  AdminModerationQuerySchema,
  AppealDecideSchema,
  AssignSchema,
  ModerationBulkSchema,
  ModerationDecisionSchema,
  ModerationRulePatchSchema,
  ModerationRuleSchema,
  ModerationRulesQuerySchema,
  ModerationStatsQuerySchema,
  QueueFailedQuerySchema,
  TrustLevelChangeSchema,
} from '@djaber/shared';
import { Platform, RequirePlatformRole } from '../../../core/auth/decorators';
import { notFound } from '../../../core/errors/app.exception';
import { bulkCtx } from '../../../core/http/bulk';
import { canPlatform } from '../../../core/rbac/permission-matrix';
import { actorOf } from '../admin-ops.util';
import { ModerationService } from './moderation.service';
import { TrustLevelService } from './trust-level.service';

class QueryDto extends createZodDto(AdminModerationQuerySchema) {}
class DecisionDto extends createZodDto(ModerationDecisionSchema) {}
class BulkDto extends createZodDto(ModerationBulkSchema) {}
class AssignDto extends createZodDto(AssignSchema) {}
class AppealsQueryDto extends createZodDto(AdminAppealsQuerySchema) {}
class AppealDecideDto extends createZodDto(AppealDecideSchema) {}
class RuleDto extends createZodDto(ModerationRuleSchema) {}
class RulePatchDto extends createZodDto(ModerationRulePatchSchema) {}
class RulesQueryDto extends createZodDto(ModerationRulesQuerySchema) {}
class StatsQueryDto extends createZodDto(ModerationStatsQuerySchema) {}
class PageDto extends createZodDto(QueueFailedQuerySchema) {}
class TrustDto extends createZodDto(TrustLevelChangeSchema) {}

const canWrite = (req: any) => canPlatform(req.user?.platformRole, 'admin.moderation.write');

@Controller('admin')
@Platform()
export class AdminModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly trust: TrustLevelService,
  ) {}

  @Get('moderation/items')
  @RequirePlatformRole('admin.moderation.read')
  list(@Query() q: QueryDto, @Req() req: any) {
    return this.moderation.list(q, actorOf(req), canWrite(req));
  }

  @Get('moderation/stats')
  @RequirePlatformRole('admin.moderation.read')
  stats(@Query() q: StatsQueryDto) {
    return this.moderation.stats(q.period);
  }

  @Get('moderation/categories')
  @RequirePlatformRole('admin.moderation.read')
  categories() {
    return this.moderation.pendingCategories();
  }

  @Get('moderation/sample')
  @RequirePlatformRole('admin.moderation.read')
  sample(@Query() q: PageDto, @Req() req: any) {
    return this.moderation.sample(q, actorOf(req), canWrite(req));
  }

  @Post('moderation/items/bulk/:action')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  bulk(@Param('action') action: string, @Body() dto: BulkDto, @Req() req: any) {
    if (action !== 'approve' && action !== 'reject' && action !== 'assign') throw notFound();
    return this.moderation.bulk(action, dto, actorOf(req), bulkCtx(req));
  }

  @Get('moderation/items/:id')
  @RequirePlatformRole('admin.moderation.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.moderation.get(id, canWrite(req));
  }

  @Post('moderation/items/:id/approve')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto, @Req() req: any) {
    return this.moderation.decide(id, 'approve', dto, actorOf(req));
  }

  @Post('moderation/items/:id/reject')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto, @Req() req: any) {
    return this.moderation.decide(id, 'reject', dto, actorOf(req));
  }

  @Post('moderation/items/:id/request-changes')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  requestChanges(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto, @Req() req: any) {
    return this.moderation.decide(id, 'request_changes', dto, actorOf(req));
  }

  @Post('moderation/items/:id/assign')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto, @Req() req: any) {
    return this.moderation.assign(id, dto.assigneeId, actorOf(req));
  }

  @Get('moderation/appeals')
  @RequirePlatformRole('admin.moderation.read')
  appeals(@Query() q: AppealsQueryDto, @Req() req: any) {
    return this.moderation.appeals(q, actorOf(req), canWrite(req));
  }

  @Post('moderation/appeals/:id/decide')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  decideAppeal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AppealDecideDto, @Req() req: any) {
    return this.moderation.decideAppeal(id, dto, actorOf(req));
  }

  @Get('moderation/rules')
  @RequirePlatformRole('admin.moderation.read')
  rules(@Query() q: RulesQueryDto) {
    return this.moderation.rules(q.kind);
  }

  @Post('moderation/rules')
  @HttpCode(201)
  @RequirePlatformRole('admin.moderation.write')
  createRule(@Body() dto: RuleDto, @Req() req: any) {
    return this.moderation.createRule(dto, actorOf(req));
  }

  @Patch('moderation/rules/:id')
  @RequirePlatformRole('admin.moderation.write')
  updateRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RulePatchDto, @Req() req: any) {
    return this.moderation.updateRule(id, dto, actorOf(req));
  }

  @Delete('moderation/rules/:id')
  @RequirePlatformRole('admin.moderation.write')
  deleteRule(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.moderation.deleteRule(id, actorOf(req));
  }

  @Post('workspaces/:id/trust-level')
  @HttpCode(200)
  @RequirePlatformRole('admin.moderation.write')
  trustLevel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TrustDto, @Req() req: any) {
    return this.trust.change(id, dto.trustLevel, dto.reason, actorOf(req));
  }
}
