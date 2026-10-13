// SMS port (M10): `SMS_GATEWAY` (fake | none) + the `sms` notification channel. Global so the provider test can reach it.
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '../../../core/config/config.service';
import { fromRepoRoot } from '../../../core/config/repo-root';
import { FakeSmsGateway, NoneSmsGateway, SMS_GATEWAY } from './sms.gateway';
import { SmsService } from './sms.service';

@Global()
@Module({
  providers: [
    {
      provide: SMS_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const gateway = config.get('SMS_DRIVER') === 'none' ? new NoneSmsGateway() : new FakeSmsGateway(fromRepoRoot(config.get('SMS_LOCAL_DIR')));
        new Logger('SmsModule').log(`sms adapter: ${gateway.driver}`);
        return gateway;
      },
    },
    SmsService,
  ],
  exports: [SMS_GATEWAY, SmsService],
})
export class SmsModule {}
