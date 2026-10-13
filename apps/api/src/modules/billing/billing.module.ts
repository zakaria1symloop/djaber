import { Module } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service';
import { RedisService } from '../../core/redis/redis.provider';
import { OrdersModule } from '../orders/orders.module';
import { AdminBillingService } from './admin-billing.service';
import { AdminBillingController, DevBillingController, DevPaymentsController, OrderPaymentsController, PaymentWebhooksController } from './billing-misc.controllers';
import { BillingController, CreditPacksController, CreditsBillingController, PlansController } from './billing.controller';
import { BillingService } from './billing.service';
import { DevBillingService, FAKE_CHARGILY } from './dev-billing.service';
import { DunningService } from './dunning.service';
import { createPaymentGateway } from './gateway/gateway.provider';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway';
import { IapService } from './iap.service';
import { STORE_VALIDATORS } from './iap/store-validators';
import { createStoreValidators } from './iap/stores.provider';
import { InvoiceService } from './invoice.service';
import { LimitService } from './limit.service';
import { OrderPaymentService } from './order-payment.service';
import { PackService } from './pack.service';
import { PaymentService } from './payment.service';
import { PlanService } from './plan.service';
import { PromoService } from './promo.service';
import { SubscriptionService } from './subscription.service';

const GATEWAY_BUNDLE = Symbol('GATEWAY_BUNDLE');

/**
 * 01-nest-module-map `billing` + `payments` (M9): plans, subscriptions (checkout, cancel, downgrade, expiry rule, dunning),
 * invoices + PDF, the Chargily gateway (the only `PaymentGateway`; simulated Chargily API when PAYMENT_DRIVER=fake), credit
 * packs (web checkout, store IAP + refunds), promo codes, manual payments, admin credit grants, order payment links and
 * refunds. Credits (ledger, reservation, periods) stay in the global CreditsModule.
 */
@Module({
  imports: [OrdersModule],
  controllers: [PlansController, CreditPacksController, BillingController, CreditsBillingController, PaymentWebhooksController, OrderPaymentsController, AdminBillingController, DevPaymentsController, DevBillingController],
  providers: [
    { provide: GATEWAY_BUNDLE, useFactory: (config: ConfigService, redis: RedisService) => createPaymentGateway(config.all, redis.client), inject: [ConfigService, RedisService] },
    { provide: PAYMENT_GATEWAY, useFactory: (b: ReturnType<typeof createPaymentGateway>) => b.gateway, inject: [GATEWAY_BUNDLE] },
    { provide: FAKE_CHARGILY, useFactory: (b: ReturnType<typeof createPaymentGateway>) => b.fake, inject: [GATEWAY_BUNDLE] },
    { provide: STORE_VALIDATORS, useFactory: (config: ConfigService) => createStoreValidators(config.all), inject: [ConfigService] },
    PlanService,
    LimitService,
    InvoiceService,
    PaymentService,
    PromoService,
    SubscriptionService,
    DunningService,
    PackService,
    IapService,
    OrderPaymentService,
    AdminBillingService,
    BillingService,
    DevBillingService,
  ],
  exports: [PAYMENT_GATEWAY, FAKE_CHARGILY, STORE_VALIDATORS, PlanService, LimitService, SubscriptionService, PaymentService, OrderPaymentService, InvoiceService, DunningService, PackService, IapService],
})
export class BillingModule {}
