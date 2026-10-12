// 06 "Billing & credits" — the read side of credits (02 §6). `GET /credits` also feeds the header pill and stays
// reachable when the workspace is suspended (01-nest-module-map §3). Packs and purchases arrive with billing (M9).
import { Controller, Get, Query } from '@nestjs/common';
import type { LedgerQuery } from '@djaber/shared';
import { RequirePermission } from '../../core/auth/decorators';
import { CreditService } from './credit.service';
import { CreditsCalculatorQueryDto, LedgerQueryDto } from './dto';

@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditService) {}

  @Get()
  @RequirePermission('billing.read_credits')
  summary() {
    return this.credits.summary();
  }

  @Get('ledger')
  @RequirePermission('billing.read')
  ledger(@Query() q: LedgerQueryDto) {
    return this.credits.ledger(q as LedgerQuery);
  }

  @Get('calculator')
  @RequirePermission('billing.read_credits')
  calculator(@Query() q: CreditsCalculatorQueryDto) {
    return this.credits.calculator(q);
  }
}
