import { Global, Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditsController } from './credits.controller';

/**
 * 01-nest-module-map `billing` — the credits part built with the AI pipeline (M4): ledger, reservation → settlement /
 * release, monthly period, quota. Global: the inbound path (messaging), the AI runs and the catalogue's "create from
 * photo" all charge through `CreditService`. Plans, packs and purchases join this module's neighbours in M9.
 */
@Global()
@Module({ controllers: [CreditsController], providers: [CreditService], exports: [CreditService] })
export class CreditsModule {}
