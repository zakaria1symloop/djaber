// D38 — merchant HELP (`/help/articles*` public, `/support/tickets*`) and ADM-12 (`/admin/support/*`, read every platform role,
// write support + super_admin). 06 §8.4, §8.11, §9.
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  AdminCreateTicketSchema,
  AdminTicketMessageSchema,
  AdminTicketsQuerySchema,
  AssignSchema,
  CannedReplyPatchSchema,
  CannedReplySchema,
  CreateTicketSchema,
  HelpArticlesQuerySchema,
  LocaleValues,
  SupportStatsQuerySchema,
  TicketEscalateSchema,
  TicketLinkIncidentSchema,
  TicketNoteSchema,
  TicketRateSchema,
  TicketReplySchema,
  TicketsQuerySchema,
} from '@djaber/shared';
import { Platform, Public, RequirePermission, RequirePlatformRole } from '../../../core/auth/decorators';
import { canPlatform } from '../../../core/rbac/permission-matrix';
import { actorOf } from '../admin-ops.util';
import { HelpService } from './help.service';
import { SupportTicketService } from './support-ticket.service';

class HelpQueryDto extends createZodDto(HelpArticlesQuerySchema) {}
class HelpGetQueryDto extends createZodDto(z.object({ lang: z.enum(LocaleValues).optional() }).strict()) {}
class CreateTicketDto extends createZodDto(CreateTicketSchema) {}
class TicketReplyDto extends createZodDto(TicketReplySchema) {}
class TicketRateDto extends createZodDto(TicketRateSchema) {}
class TicketsQueryDto extends createZodDto(TicketsQuerySchema) {}
class AdminTicketsQueryDto extends createZodDto(AdminTicketsQuerySchema) {}
class AdminCreateTicketDto extends createZodDto(AdminCreateTicketSchema) {}
class AdminTicketMessageDto extends createZodDto(AdminTicketMessageSchema) {}
class AssignDto extends createZodDto(AssignSchema) {}
class NoteDto extends createZodDto(TicketNoteSchema) {}
class EscalateDto extends createZodDto(TicketEscalateSchema) {}
class LinkIncidentDto extends createZodDto(TicketLinkIncidentSchema) {}
class EmptyDto extends createZodDto(z.object({}).strict()) {}
class StatsDto extends createZodDto(SupportStatsQuerySchema) {}
class CannedDto extends createZodDto(CannedReplySchema) {}
class CannedPatchDto extends createZodDto(CannedReplyPatchSchema) {}

/** Published help content is public (06 §12, route map `/help` public + in-app): one route for the web, the app and the "?" panel. */
@Controller('help')
export class HelpController {
  constructor(private readonly help: HelpService) {}

  @Public()
  @Get('articles')
  list(@Query() q: HelpQueryDto, @Req() req: any) {
    return this.help.list(q, req.locale ?? 'fr');
  }

  @Public()
  @Get('articles/:key')
  get(@Param('key') key: string, @Query() q: HelpGetQueryDto, @Req() req: any) {
    return this.help.get(key, q.lang, req.locale ?? 'fr');
  }
}

@Controller('support/tickets')
export class SupportController {
  constructor(private readonly tickets: SupportTicketService) {}

  @Get()
  @RequirePermission('support.write')
  list(@Query() q: TicketsQueryDto) {
    return this.tickets.list(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('support.write')
  create(@Body() dto: CreateTicketDto, @Req() req: any) {
    return this.tickets.create(dto, req.headers?.['x-app-platform'] ? 'mobile' : 'web');
  }

  @Get(':id')
  @RequirePermission('support.write')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.get(id);
  }

  @Post(':id/messages')
  @HttpCode(201)
  @RequirePermission('support.write')
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketReplyDto) {
    return this.tickets.reply(id, dto);
  }

  @Post(':id/rate')
  @HttpCode(200)
  @RequirePermission('support.write')
  rate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketRateDto) {
    return this.tickets.rate(id, dto);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('support.write')
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.close(id);
  }
}

const canWrite = (req: any) => canPlatform(req.user?.platformRole, 'admin.support.write');

@Controller('admin/support')
@Platform()
export class AdminSupportController {
  constructor(private readonly tickets: SupportTicketService) {}

  @Get('tickets')
  @RequirePlatformRole('admin.support.read')
  list(@Query() q: AdminTicketsQueryDto, @Req() req: any) {
    return this.tickets.adminList(q, actorOf(req), canWrite(req));
  }

  @Post('tickets')
  @HttpCode(201)
  @RequirePlatformRole('admin.support.write')
  create(@Body() dto: AdminCreateTicketDto, @Req() req: any) {
    return this.tickets.adminCreate(dto, actorOf(req));
  }

  @Get('stats')
  @RequirePlatformRole('admin.support.read')
  stats(@Query() q: StatsDto, @Req() req: any) {
    return this.tickets.stats(q.period, actorOf(req));
  }

  @Get('canned-replies')
  @RequirePlatformRole('admin.support.read')
  canned() {
    return this.tickets.cannedList();
  }

  @Post('canned-replies')
  @HttpCode(201)
  @RequirePlatformRole('admin.support.write')
  cannedCreate(@Body() dto: CannedDto, @Req() req: any) {
    return this.tickets.cannedCreate(dto, actorOf(req));
  }

  @Patch('canned-replies/:id')
  @RequirePlatformRole('admin.support.write')
  cannedUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CannedPatchDto, @Req() req: any) {
    return this.tickets.cannedUpdate(id, dto, actorOf(req));
  }

  @Delete('canned-replies/:id')
  @RequirePlatformRole('admin.support.write')
  cannedDelete(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.tickets.cannedDelete(id, actorOf(req));
  }

  @Get('tickets/:id')
  @RequirePlatformRole('admin.support.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.tickets.adminGet(id, canWrite(req));
  }

  @Post('tickets/:id/messages')
  @HttpCode(201)
  @RequirePlatformRole('admin.support.write')
  message(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminTicketMessageDto, @Req() req: any) {
    return this.tickets.adminMessage(id, dto, actorOf(req));
  }

  @Post('tickets/:id/assign')
  @HttpCode(200)
  @RequirePlatformRole('admin.support.write')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto, @Req() req: any) {
    return this.tickets.assign(id, dto.assigneeId, actorOf(req));
  }

  @Post('tickets/:id/resolve')
  @HttpCode(200)
  @RequirePlatformRole('admin.support.write')
  resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto, @Req() req: any) {
    return this.tickets.resolve(id, dto.note, actorOf(req));
  }

  @Post('tickets/:id/reopen')
  @HttpCode(200)
  @RequirePlatformRole('admin.support.write')
  reopen(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto, @Req() req: any) {
    return this.tickets.reopen(id, actorOf(req));
  }

  @Post('tickets/:id/wait-customer')
  @HttpCode(200)
  @RequirePlatformRole('admin.support.write')
  waitCustomer(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: EmptyDto, @Req() req: any) {
    return this.tickets.waitCustomer(id, actorOf(req));
  }

  @Post('tickets/:id/escalate')
  @HttpCode(200)
  @RequirePlatformRole('admin.support.write')
  escalate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EscalateDto, @Req() req: any) {
    return this.tickets.escalate(id, dto.note, actorOf(req));
  }

  @Post('tickets/:id/link-incident')
  @HttpCode(200)
  @RequirePlatformRole('admin.support.write')
  linkIncident(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkIncidentDto, @Req() req: any) {
    return this.tickets.linkIncident(id, dto.incidentId, actorOf(req));
  }
}
