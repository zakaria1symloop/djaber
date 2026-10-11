// 06-api "Channels" + §8.7 — reads: `channels.read` (every member); connect / reconnect / pause / disconnect / sync:
// `channels.manage` (Admin+), connect and reconnect also need a verified e-mail (AUTH-04, 01-nest-module-map §3).
// Literal sub-paths (`app-review-status`, `connect/*`, `callback/*`) are declared before `:id`.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CHANNEL_INFO_SYNC_COOLDOWN_S, CONNECT_MESSAGE_TYPE, type ChannelEventsQuery, type ChannelsQuery, type ConnectReport } from '@djaber/shared';
import { prisma } from '@djaber/db';
import { Audited, Public, RequirePermission, RequireVerifiedEmail } from '../../core/auth/decorators';
import { ConfigService } from '../../core/config/config.service';
import { AppException, notFound } from '../../core/errors/app.exception';
import { RateLimitGuard } from '../../core/throttle/rate-limit.guard';
import { JobService } from '../jobs/job.service';
import { ChannelService } from './channel.service';
import { ConnectService } from './connect.service';
import { ChannelEventsQueryDto, ChannelsQueryDto, EnableChannelDto, SyncHistoryDto, UpdateChannelDto } from './dto';

const Id = () => Param('id', ParseUUIDPipe);
const platformOf = (p: string) => {
  if (p !== 'facebook' && p !== 'instagram') throw notFound();
  return p;
};
/** JSON safe to inline in a `<script>` block. */
const inline = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelService,
    private readonly connect: ConnectService,
    private readonly jobs: JobService,
    private readonly limits: RateLimitGuard,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @RequirePermission('channels.read')
  list(@Query() q: ChannelsQueryDto) {
    return this.channels.list(q as ChannelsQuery);
  }

  /** CHN-11: drives the "approval pending" notices of the connect screens. */
  @Get('app-review-status')
  @RequirePermission('channels.read')
  appReviewStatus() {
    return this.channels.appReviewStatus();
  }

  // --- connect (FL-05) ----------------------------------------------------------------------------------------------------
  @Get('connect/reports/:reportId')
  @RequirePermission('channels.read')
  report(@Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.connect.report(reportId);
  }

  @Get('connect/:platform')
  @RequirePermission('channels.manage')
  @RequireVerifiedEmail()
  start(@Param('platform') platform: string) {
    return this.connect.start(platformOf(platform));
  }

  /**
   * OAuth return. Browsers get a tiny page that posts the report to the opener (`postMessage`) and closes, or — when
   * there is no opener (same-tab flow) — goes back to the web app; API clients asking for JSON get the report itself.
   */
  @Public()
  @Get('callback/:platform')
  async callback(@Param('platform') platform: string, @Query() q: Record<string, string>, @Req() req: any, @Res() res: any) {
    const report = await this.connect.callback(platformOf(platform), q, req.locale ?? 'fr');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const accept = String(req.headers.accept ?? '');
    if (accept.includes('application/json') && !accept.includes('text/html')) return res.status(200).json({ data: report, meta: { warnings: [] } });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const nonce = randomBytes(16).toString('base64');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
    // the popup must keep its opener across the Meta round trip
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    return res.status(200).send(this.callbackPage(report, nonce));
  }

  private callbackPage(report: ConnectReport, nonce: string) {
    const web = this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '');
    const origins = [...new Set([new URL(web).origin, ...this.config.webOrigins])];
    const back =
      report.outcome === 'error'
        ? `${web}/channels/connect/return?connectError=${encodeURIComponent(report.error?.code ?? 'OAUTH_CANCELLED')}`
        : `${web}/channels/connect/return?connectReport=${report.id}`;
    return [
      '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Djaber</title></head>',
      '<body style="font:14px system-ui,sans-serif;color:#444;padding:24px"><p>…</p>',
      `<script nonce="${nonce}">(function(){var m=${inline({ type: CONNECT_MESSAGE_TYPE, report })},o=${inline(origins)},b=${inline(back)};`,
      'try{if(window.opener&&!window.opener.closed){for(var i=0;i<o.length;i++){window.opener.postMessage(m,o[i]);}window.close();return;}}catch(e){}',
      'window.location.replace(b);})();</script></body></html>',
    ].join('\n');
  }

  // --- one channel --------------------------------------------------------------------------------------------------------
  @Get(':id')
  @RequirePermission('channels.read')
  get(@Id() id: string) {
    return this.channels.get(id);
  }

  @Patch(':id')
  @RequirePermission('channels.manage')
  @Audited({ entity: 'Channel', action: 'channel.status' })
  update(@Id() id: string, @Body() dto: UpdateChannelDto) {
    return dto.status === 'paused' ? this.channels.pause(id) : this.channels.resume(id, dto.swapWithChannelId);
  }

  @Delete(':id')
  @RequirePermission('channels.manage')
  disconnect(@Id() id: string) {
    return this.channels.disconnect(id);
  }

  @Post(':id/reconnect')
  @HttpCode(200)
  @RequirePermission('channels.manage')
  @RequireVerifiedEmail()
  reconnect(@Id() id: string) {
    return this.connect.reconnect(id);
  }

  @Post(':id/disable')
  @HttpCode(200)
  @RequirePermission('channels.manage')
  @Audited({ entity: 'Channel', action: 'channel.disable' })
  disable(@Id() id: string) {
    return this.channels.disable(id);
  }

  @Post(':id/enable')
  @HttpCode(200)
  @RequirePermission('channels.manage')
  @Audited({ entity: 'Channel', action: 'channel.enable' })
  enable(@Id() id: string, @Body() dto: EnableChannelDto) {
    return this.channels.resume(id, dto.swapWithChannelId);
  }

  /** Name, avatar, followers — 1 / 10 min / channel (api-contract §1.9). The refresh itself is a queued job. */
  @Post(':id/sync-info')
  @HttpCode(202)
  @RequirePermission('channels.manage')
  async syncInfo(@Id() id: string) {
    await this.channels.row(id);
    await this.limits.hit('channel-sync-info', id, 1, CHANNEL_INFO_SYNC_COOLDOWN_S);
    return this.channels.requestInfoSync(id);
  }

  /** CHN-09: history sync (≤ 25 conversations × 25 messages) as a background job → `202 { jobId }`. */
  @Post(':id/sync')
  @HttpCode(202)
  @RequirePermission('channels.manage')
  async sync(@Id() id: string, @Body() dto: SyncHistoryDto) {
    const c = await this.channels.row(id);
    if (c.status === 'needs_reconnect') throw new AppException('PAGE_SYNC_TOKEN_EXPIRED');
    if (c.status !== 'active' || !c.accessToken) throw new AppException('REPLY_CHANNEL_INACTIVE', {}, {}, { status: c.status });
    const running = await prisma.job.findFirst({ where: { workspaceId: c.workspaceId, kind: 'sync_history', status: { in: ['queued', 'running'] }, payload: { path: ['channelId'], equals: id } } });
    if (running) return { jobId: running.id };
    const job = await this.jobs.create({ kind: 'sync_history', name: 'history-sync', payload: { channelId: id, days: dto.days } });
    return { jobId: job.id };
  }

  @Get(':id/insights')
  @RequirePermission('channels.read')
  insights(@Id() id: string) {
    return this.channels.insights(id);
  }

  @Get(':id/summary')
  @RequirePermission('channels.read')
  summary(@Id() id: string) {
    return this.channels.summary(id);
  }

  @Get(':id/events')
  @RequirePermission('channels.read')
  events(@Id() id: string, @Query() q: ChannelEventsQueryDto) {
    return this.channels.eventsOf(id, q as ChannelEventsQuery);
  }

  @Get(':id/approval-status')
  @RequirePermission('channels.read')
  approvalStatus(@Id() id: string) {
    return this.channels.approvalStatus(id);
  }
}
