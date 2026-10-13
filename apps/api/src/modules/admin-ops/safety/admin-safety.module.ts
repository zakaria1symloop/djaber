// ADM-11 (D37): abuse reports, platform blacklist ⇒ CustomerBlock(source=platform), platform blocked words, platform
// auto-rules (`sched-abuse-auto-rules`), monthly compliance export. Merchant side: messaging `SafetyService`.
import { Module } from '@nestjs/common';
import { AdminSafetyController } from './admin-safety.controller';
import { AdminSafetyService } from './admin-safety.service';

@Module({
  controllers: [AdminSafetyController],
  providers: [AdminSafetyService],
  exports: [AdminSafetyService],
})
export class AdminSafetyModule {}
