// 09-code-conventions §3.6 — reads `inbox.read` (inbox "/" popover), writes `workspace.settings` (01 §3.2).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Audited, RequirePermission } from '../../core/auth/decorators';
import { CreateQuickReplyDto, ReorderQuickRepliesDto, UpdateQuickReplyDto } from './dto';
import { QuickReplyService } from './quick-reply.service';

@Controller('workspace/quick-replies')
export class QuickReplyController {
  constructor(private readonly svc: QuickReplyService) {}

  @Get()
  @RequirePermission('inbox.read')
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermission('workspace.settings')
  @Audited({ entity: 'QuickReply', action: 'quick_reply.create', idFrom: 'result.id' })
  create(@Body() dto: CreateQuickReplyDto) {
    return this.svc.create(dto);
  }

  @Patch('order')
  @RequirePermission('workspace.settings')
  reorder(@Body() dto: ReorderQuickRepliesDto) {
    return this.svc.reorder(dto.ids);
  }

  @Patch(':id')
  @RequirePermission('workspace.settings')
  @Audited({ entity: 'QuickReply', action: 'quick_reply.update' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuickReplyDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('workspace.settings')
  @HttpCode(204)
  @Audited({ entity: 'QuickReply', action: 'quick_reply.delete' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
  }
}
