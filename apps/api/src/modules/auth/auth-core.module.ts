import { Module } from '@nestjs/common';
import { EmailTokenService } from './email-token.service';
import { ReauthService } from './reauth.service';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';

/** Identity primitives shared by the auth and workspace modules (no HTTP layer, no dependency on either). */
const providers = [SessionService, TwoFactorService, EmailTokenService, ReauthService];
@Module({ providers, exports: providers })
export class AuthCoreModule {}
