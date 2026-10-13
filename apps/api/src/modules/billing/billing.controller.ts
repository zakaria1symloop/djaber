// 06-api "Billing & credits" + §8.9, api-contract §3.10, permissions 01-nest-module-map §3.2:
//   billing.read (Owner, Admin) · billing.write (Owner, Admin: packs, promo, invoice pay, IAP) · billing.plan (Owner: plan
//   change, cancel, billing info) · billing.read_credits (every member). Plan changes are web-only (D73).
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, StreamableFile } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import {
  BillingInfoSchema,
  BillingPaymentsQuerySchema,
  CancelSubscriptionSchema,
  CheckoutReturnQuerySchema,
  CheckoutSchema,
  CreditPacksQuerySchema,
  IapValidateSchema,
  InvoicesQuerySchema,
  LedgerExportQuerySchema,
  PackCheckoutSchema,
  PackPurchasesQuerySchema,
  PromoRedeemSchema,
  PromoValidateSchema,
  type InvoicesQuery,
  type LedgerExportQuery,
} from '@djaber/shared';
import { Idempotent, Public, RequirePermission } from '../../core/auth/decorators';
import { BillingService } from './billing.service';
import { IapService } from './iap.service';
import { PackService } from './pack.service';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';

class CheckoutDto extends createZodDto(CheckoutSchema) {}
class CancelSubscriptionDto extends createZodDto(CancelSubscriptionSchema) {}
class BillingInfoDto extends createZodDto(BillingInfoSchema) {}
class InvoicesQueryDto extends createZodDto(InvoicesQuerySchema) {}
class BillingPaymentsQueryDto extends createZodDto(BillingPaymentsQuerySchema) {}
class PromoValidateDto extends createZodDto(PromoValidateSchema) {}
class PromoRedeemDto extends createZodDto(PromoRedeemSchema) {}
class CheckoutReturnQueryDto extends createZodDto(CheckoutReturnQuerySchema) {}
class CreditPacksQueryDto extends createZodDto(CreditPacksQuerySchema) {}
class PackCheckoutDto extends createZodDto(PackCheckoutSchema) {}
class PackPurchasesQueryDto extends createZodDto(PackPurchasesQuerySchema) {}
class IapValidateDto extends createZodDto(IapValidateSchema) {}
class LedgerExportQueryDto extends createZodDto(LedgerExportQuerySchema) {}

const loc = (req: any): 'fr' | 'ar' | 'en' => (req.locale === 'ar' || req.locale === 'en' ? req.locale : 'fr');
/** D73: the mobile app sends `X-App-Platform: android|ios` (04 §15). */
export const platformOf = (req: any): 'web' | 'mobile' => {
  const p = String(req.headers?.['x-app-platform'] ?? '').toLowerCase();
  return p === 'android' || p === 'ios' ? 'mobile' : 'web';
};

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlanService) {}

  @Public()
  @Get()
  list(@Req() req: any) {
    return this.plans.list(loc(req));
  }
}

@Controller('credit-packs')
export class CreditPacksController {
  constructor(private readonly packs: PackService) {}

  @Public()
  @Get()
  list(@Query() q: CreditPacksQueryDto, @Req() req: any) {
    return this.packs.list(q.platform, loc(req));
  }
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly subs: SubscriptionService,
    private readonly billing: BillingService,
  ) {}

  @Get('subscription')
  @RequirePermission('billing.read')
  subscription(@Req() req: any) {
    return this.subs.dto(loc(req));
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermission('billing.plan')
  async preview(@Body() dto: CheckoutDto, @Req() req: any) {
    const platform = platformOf(req);
    if (platform === 'mobile') return this.billing.forbiddenOnMobile();
    return this.subs.toPreview(await this.subs.quote(dto.planId, dto.cycle, dto.promoCode, platform), loc(req));
  }

  @Post('checkout')
  @HttpCode(200)
  @RequirePermission('billing.plan')
  @Idempotent({ required: true })
  checkout(@Body() dto: CheckoutDto, @Req() req: any) {
    return this.subs.checkout(dto, platformOf(req), loc(req));
  }

  @Get('checkout/return')
  @RequirePermission('billing.read')
  checkoutReturn(@Query() q: CheckoutReturnQueryDto, @Req() req: any) {
    return this.billing.checkoutReturn(q.ref, loc(req));
  }

  @Post('cancel')
  @HttpCode(200)
  @RequirePermission('billing.plan')
  async cancel(@Body() dto: CancelSubscriptionDto, @Req() req: any) {
    if (platformOf(req) === 'mobile') return this.billing.forbiddenOnMobile();
    await this.subs.cancel(dto.reason);
    return this.subs.dto(loc(req));
  }

  @Post('cancel/undo')
  @HttpCode(200)
  @RequirePermission('billing.plan')
  undoCancelPost(@Req() req: any) {
    return this.undoCancel(req);
  }

  @Delete('cancel')
  @RequirePermission('billing.plan')
  async undoCancel(@Req() req: any) {
    if (platformOf(req) === 'mobile') return this.billing.forbiddenOnMobile();
    await this.subs.undoCancel();
    return this.subs.dto(loc(req));
  }

  @Get('info')
  @RequirePermission('billing.read')
  info() {
    return this.billing.info();
  }

  @Put('info')
  @RequirePermission('billing.plan')
  saveInfo(@Body() dto: BillingInfoDto) {
    return this.billing.saveInfo(dto);
  }

  @Get('invoices')
  @RequirePermission('billing.read')
  invoices(@Query() q: InvoicesQueryDto, @Req() req: any) {
    return this.billing.invoices(q as InvoicesQuery, loc(req));
  }

  @Get('invoices/:id/pdf')
  @RequirePermission('billing.read')
  async invoicePdf(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const f = await this.billing.invoicePdf(id, loc(req));
    return new StreamableFile(f.body, { type: 'application/pdf', disposition: `inline; filename="${f.fileName}"`, length: f.body.length });
  }

  @Post('invoices/:id/pay')
  @HttpCode(200)
  @RequirePermission('billing.write')
  pay(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.billing.payInvoice(id, loc(req));
  }

  @Get('payments')
  @RequirePermission('billing.read')
  payments(@Query() q: BillingPaymentsQueryDto) {
    return this.billing.listPayments(q);
  }

  @Post('promo/validate')
  @HttpCode(200)
  @RequirePermission('billing.write')
  validatePromo(@Body() dto: PromoValidateDto, @Req() req: any) {
    return this.billing.validatePromo(dto.code, dto.planId, platformOf(req));
  }

  @Post('promo/redeem')
  @HttpCode(200)
  @RequirePermission('billing.write')
  redeemPromo(@Body() dto: PromoRedeemDto, @Req() req: any) {
    return this.billing.redeemPromo(dto.code, platformOf(req));
  }
}

/** Credits additions of M9 (the M4 reads `GET /credits`, `/credits/ledger`, `/credits/calculator` live in CreditsController). */
@Controller('credits')
export class CreditsBillingController {
  constructor(
    private readonly packs: PackService,
    private readonly iap: IapService,
    private readonly billing: BillingService,
  ) {}

  @Get('ledger/export')
  @HttpCode(202)
  @RequirePermission('billing.read')
  exportLedger(@Query() q: LedgerExportQueryDto) {
    return this.billing.exportLedger(q as LedgerExportQuery);
  }

  @Post('packs/checkout')
  @HttpCode(200)
  @RequirePermission('billing.write')
  @Idempotent({ required: true })
  packCheckout(@Body() dto: PackCheckoutDto, @Req() req: any) {
    return this.packs.checkout(dto.packId, loc(req));
  }

  @Get('packs/purchases')
  @RequirePermission('billing.read')
  purchases(@Query() q: PackPurchasesQueryDto, @Req() req: any) {
    return this.packs.purchases(q, loc(req));
  }

  @Post('packs/iap/validate')
  @HttpCode(200)
  @RequirePermission('billing.write')
  @Idempotent({ required: true })
  iapValidate(@Body() dto: IapValidateDto) {
    return this.iap.validate(dto);
  }
}
