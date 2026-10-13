// ADM-13 — `/admin/settings*`, app versions, feature flags, legal documents, Meta, providers, maintenance, incident banner
// (06 §8.11 / §9: read every platform role; settings write super_admin; legal publish `admin.cms.write`; maintenance and
// incident banner `admin.health.write`) + the merchant `GET /feature-flags?platform` (06 §11).
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import {
  AppVersionUpdateSchema,
  FeatureFlagCreateSchema,
  FeatureFlagEvaluateQuerySchema,
  FeatureFlagPatchSchema,
  FeatureFlagsQuerySchema,
  IncidentBannerSchema,
  LegalDocKeyValues,
  LegalPublishSchema,
  MaintenanceSchema,
  MetaAppSchema,
  MetaPermissionPatchSchema,
  ProviderUpdateSchema,
  SettingUpdateSchema,
} from '@djaber/shared';
import { TenantContext, type AppPlatform, type LegalDocKey } from '@djaber/db';
import { Platform, RequirePermission, RequirePlatformRole } from '../../../core/auth/decorators';
import { notFound } from '../../../core/errors/app.exception';
import { FlagsService } from '../../../core/flags/flags.service';
import { actorOf } from '../admin-ops.util';
import { PlatformSettingsService } from './platform-settings.service';

class SettingDto extends createZodDto(SettingUpdateSchema) {}
class AppVersionDto extends createZodDto(AppVersionUpdateSchema) {}
class FlagDto extends createZodDto(FeatureFlagCreateSchema) {}
class FlagPatchDto extends createZodDto(FeatureFlagPatchSchema) {}
class EvaluateDto extends createZodDto(FeatureFlagEvaluateQuerySchema) {}
class FlagsQueryDto extends createZodDto(FeatureFlagsQuerySchema) {}
class LegalDto extends createZodDto(LegalPublishSchema) {}
class MetaPermDto extends createZodDto(MetaPermissionPatchSchema) {}
class MetaAppBodyDto extends createZodDto(MetaAppSchema) {}
class ProviderDto extends createZodDto(ProviderUpdateSchema) {}
class MaintenanceDto extends createZodDto(MaintenanceSchema) {}
class BannerDto extends createZodDto(IncidentBannerSchema) {}

const platformOf = (p: string): AppPlatform => {
  if (p !== 'android' && p !== 'ios') throw notFound();
  return p;
};
const legalKey = (k: string): LegalDocKey => {
  if (!(LegalDocKeyValues as readonly string[]).includes(k)) throw notFound();
  return k as LegalDocKey;
};

@Controller('admin')
@Platform()
export class AdminSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('settings')
  @RequirePlatformRole('admin.settings.read')
  all() {
    return this.settings.getAll();
  }

  @Put('settings/:key')
  @RequirePlatformRole('admin.settings.write')
  update(@Param('key') key: string, @Body() dto: SettingDto, @Req() req: any) {
    return this.settings.updateSetting(key, dto.value, dto.reason, actorOf(req));
  }

  @Get('settings/:key/versions')
  @RequirePlatformRole('admin.settings.read')
  versions(@Param('key') key: string) {
    return this.settings.versions(key);
  }

  @Get('app-versions')
  @RequirePlatformRole('admin.settings.read')
  appVersions() {
    return this.settings.appVersions();
  }

  @Get('app-versions/:platform')
  @RequirePlatformRole('admin.settings.read')
  appVersion(@Param('platform') platform: string) {
    return this.settings.appVersion(platformOf(platform));
  }

  @Put('app-versions/:platform')
  @RequirePlatformRole('admin.settings.write')
  updateAppVersion(@Param('platform') platform: string, @Body() dto: AppVersionDto, @Req() req: any) {
    return this.settings.updateAppVersion(platformOf(platform), dto, actorOf(req));
  }

  @Get('feature-flags')
  @RequirePlatformRole('admin.settings.read')
  flags() {
    return this.settings.listFlags();
  }

  @Post('feature-flags')
  @HttpCode(201)
  @RequirePlatformRole('admin.settings.write')
  createFlag(@Body() dto: FlagDto, @Req() req: any) {
    return this.settings.createFlag(dto, actorOf(req));
  }

  @Get('feature-flags/:key/evaluate')
  @RequirePlatformRole('admin.settings.read')
  evaluate(@Param('key') key: string, @Query() q: EvaluateDto) {
    return this.settings.evaluateFlag(key, q.workspaceId, q.platform);
  }

  @Patch('feature-flags/:key')
  @RequirePlatformRole('admin.settings.write')
  updateFlag(@Param('key') key: string, @Body() dto: FlagPatchDto, @Req() req: any) {
    return this.settings.updateFlag(key, dto, actorOf(req));
  }

  @Delete('feature-flags/:key')
  @RequirePlatformRole('admin.settings.write')
  deleteFlag(@Param('key') key: string, @Req() req: any) {
    return this.settings.deleteFlag(key, actorOf(req));
  }

  @Get('legal-documents')
  @RequirePlatformRole('admin.settings.read')
  legal() {
    return this.settings.legalDocuments();
  }

  @Post('legal-documents/:key/publish')
  @HttpCode(201)
  @RequirePlatformRole('admin.cms.write')
  publish(@Param('key') key: string, @Body() dto: LegalDto, @Req() req: any) {
    return this.settings.publishLegal(legalKey(key), dto, actorOf(req));
  }

  @Get('legal-documents/:key/acceptance-stats')
  @RequirePlatformRole('admin.settings.read')
  acceptance(@Param('key') key: string) {
    return this.settings.acceptanceStats(legalKey(key));
  }

  @Get('meta/permissions')
  @RequirePlatformRole('admin.settings.read')
  metaPermissions() {
    return this.settings.metaPermissions();
  }

  @Patch('meta/permissions/:scope')
  @RequirePlatformRole('admin.settings.write')
  metaPermission(@Param('scope') scope: string, @Body() dto: MetaPermDto, @Req() req: any) {
    return this.settings.updateMetaPermission(scope, dto, actorOf(req));
  }

  @Get('meta/app')
  @RequirePlatformRole('admin.settings.read')
  metaApp() {
    return this.settings.metaApp();
  }

  @Put('meta/app')
  @RequirePlatformRole('admin.settings.write')
  setMetaApp(@Body() dto: MetaAppBodyDto, @Req() req: any) {
    return this.settings.setMetaApp(dto, actorOf(req));
  }

  @Get('providers')
  @RequirePlatformRole('admin.settings.read')
  providers() {
    return this.settings.providers();
  }

  @Put('providers/:key')
  @RequirePlatformRole('admin.settings.write')
  updateProvider(@Param('key') key: string, @Body() dto: ProviderDto, @Req() req: any) {
    return this.settings.updateProvider(key, dto, actorOf(req));
  }

  @Post('providers/:key/test')
  @HttpCode(200)
  @RequirePlatformRole('admin.settings.write')
  testProvider(@Param('key') key: string, @Req() req: any) {
    return this.settings.testProvider(key, actorOf(req));
  }

  @Get('maintenance')
  @RequirePlatformRole('admin.settings.read')
  maintenance() {
    return this.settings.maintenance();
  }

  @Put('maintenance')
  @RequirePlatformRole('admin.health.write')
  setMaintenance(@Body() dto: MaintenanceDto, @Req() req: any) {
    return this.settings.setMaintenance(dto, actorOf(req));
  }

  @Get('incident-banner')
  @RequirePlatformRole('admin.settings.read')
  banner() {
    return this.settings.incidentBanner();
  }

  @Put('incident-banner')
  @RequirePlatformRole('admin.health.write')
  setBanner(@Body() dto: BannerDto, @Req() req: any) {
    return this.settings.setIncidentBanner(dto, actorOf(req));
  }
}

/** `GET /feature-flags?platform=web|mobile` → `{ [key]: boolean }` for the current workspace (06 §11). */
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Get()
  @RequirePermission('workspace.read')
  list(@Query() q: FlagsQueryDto) {
    return this.flags.allFor(TenantContext.workspaceId(), q.platform);
  }
}
