import { Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller';
import { GeoController } from './geo.controller';

/** Public reference endpoints available from M0: app version check, wilayas / communes. */
@Module({ controllers: [AppVersionController, GeoController] })
export class PlatformPublicModule {}
