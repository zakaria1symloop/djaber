import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { FeeService } from './fee.service';
import { GeoService } from './geo.service';

/**
 * 01-nest-module-map `delivery` — M5 half: fee grid (DLV-01/02), quote, geo checks and stop-desks (DLV-09).
 * Courier accounts, adapters, shipments, tracking and labels are added by M6.
 */
@Module({ controllers: [DeliveryController], providers: [FeeService, GeoService], exports: [FeeService, GeoService] })
export class DeliveryModule {}
