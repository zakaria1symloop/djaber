// The Meta port and its adapter. SAFETY: the live V1 product uses the same Meta app, so the Graph adapter is refused
// in development / test unless META_ALLOW_LIVE=true is set on purpose (01-nest-module-map §9: fake adapters by default).
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service';
import type { AppConfig } from '../../core/config/config.schema';
import { FakeMetaGateway } from './fake-meta.gateway';
import { GraphMetaGateway } from './graph-meta.gateway';
import { META_GATEWAY, type MetaGateway } from './meta.gateway';

type MetaEnv = Pick<AppConfig, 'NODE_ENV' | 'META_DRIVER' | 'META_ALLOW_LIVE' | 'META_APP_ID' | 'META_APP_SECRET' | 'INSTAGRAM_APP_ID' | 'INSTAGRAM_APP_SECRET' | 'META_GRAPH_VERSION'>;

export const createMetaGateway = (env: MetaEnv): MetaGateway => {
  if (env.META_DRIVER !== 'graph') return new FakeMetaGateway();
  const local = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  if (local && !env.META_ALLOW_LIVE) {
    throw new Error('META_DRIVER=graph is refused in development / test: set META_DRIVER=fake (or META_ALLOW_LIVE=true if you really mean to call the live Meta app)');
  }
  if (!env.META_APP_ID || !env.META_APP_SECRET) throw new Error('META_DRIVER=graph requires META_APP_ID and META_APP_SECRET');
  return new GraphMetaGateway({
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    instagramAppId: env.INSTAGRAM_APP_ID ?? '',
    instagramAppSecret: env.INSTAGRAM_APP_SECRET ?? '',
    version: env.META_GRAPH_VERSION,
  });
};

@Global()
@Module({
  providers: [
    {
      provide: META_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const gateway = createMetaGateway(config.all);
        new Logger('MetaModule').log(`Meta adapter: ${gateway.driver}`);
        return gateway;
      },
    },
  ],
  exports: [META_GATEWAY],
})
export class MetaModule {}
