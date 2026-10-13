// Picks the store validators. SAFETY: `IAP_DRIVER=stores` is refused in development / test unless `IAP_ALLOW_LIVE=true`.
import type { AppConfig } from '../../../core/config/config.schema';
import { fetchPayTransport, type PayTransport } from '../gateway/chargily.gateway';
import { FakeStoreValidators } from './fake-stores';
import { LiveStoreValidators } from './live-stores';
import type { StoreValidators } from './store-validators';

type IapEnv = Pick<
  AppConfig,
  'NODE_ENV' | 'IAP_DRIVER' | 'IAP_ALLOW_LIVE' | 'GOOGLE_PLAY_SERVICE_ACCOUNT' | 'GOOGLE_PLAY_PACKAGE_NAME' | 'GOOGLE_PLAY_PUBSUB_TOKEN' | 'APPLE_IAP_KEY_ID' | 'APPLE_IAP_ISSUER_ID' | 'APPLE_IAP_PRIVATE_KEY' | 'APPLE_IAP_BUNDLE_ID' | 'APPLE_IAP_ENV' | 'APPLE_ROOT_CA_SHA256'
>;

export const createStoreValidators = (env: IapEnv, transport?: PayTransport): StoreValidators => {
  if (env.IAP_DRIVER !== 'stores') return new FakeStoreValidators({ bundleId: env.APPLE_IAP_BUNDLE_ID, pubsubToken: undefined });
  const local = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  if (local && !env.IAP_ALLOW_LIVE) {
    throw new Error('IAP_DRIVER=stores is refused in development / test: set IAP_DRIVER=fake (or IAP_ALLOW_LIVE=true if you really mean to call Google Play / App Store)');
  }
  return new LiveStoreValidators(env, transport ?? fetchPayTransport());
};
