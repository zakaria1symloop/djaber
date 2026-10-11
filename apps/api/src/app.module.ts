import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuditInterceptor } from './core/audit/audit.interceptor';
import { AuthGuard } from './core/auth/auth.guard';
import { CoreModule } from './core/core.module';
import { AppExceptionFilter } from './core/errors/app-exception.filter';
import { HealthController } from './core/health/health.controller';
import { EnvelopeInterceptor } from './core/http/envelope.interceptor';
import { RequestContextMiddleware } from './core/http/request-context.middleware';
import { IdempotencyInterceptor } from './core/idempotency/idempotency.interceptor';
import { PermissionGuard } from './core/rbac/permission.guard';
import { FilesController } from './core/storage/files.controller';
import { TenantGuard } from './core/tenancy/tenant.guard';
import { RateLimitGuard } from './core/throttle/rate-limit.guard';
import { WsGateway } from './core/ws/ws.gateway';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { LegalGuard } from './modules/workspace/legal.guard';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { PlatformPublicModule } from './modules/platform-public/platform-public.module';

/** Feature modules are appended here milestone after milestone (00-build-order). */
export const FEATURE_MODULES = [PlatformPublicModule, AccountModule, UploadsModule, WorkspaceModule, AuthModule];

@Module({
  imports: [CoreModule, ...FEATURE_MODULES],
  controllers: [HealthController, FilesController],
  providers: [
    WsGateway,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Guard order = pipeline of 01-nest-module-map §3: auth → rate limit → tenant → permission
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 04 §15: 403 LEGAL_REACCEPT_REQUIRED until a major legal version is accepted (auth / legal routes exempt)
    { provide: APP_GUARD, useClass: LegalGuard },
    // Interceptor order: envelope (outermost) → idempotency → audit
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
