// SAFETY (M11 brief, like PAYMENT / COURIER / AI): the Google driver is refused in development / test unless
// SHEETS_ALLOW_LIVE=true is set on purpose; without a Google OAuth client the fake driver is the only possible one.
import type Redis from 'ioredis';
import type { AppConfig } from '../../../core/config/config.schema';
import { FakeSheetsGateway } from './fake-sheets.gateway';
import { GoogleSheetsGateway } from './google-sheets.gateway';
import type { SheetsGateway } from './sheets.gateway';

type SheetsEnv = Pick<AppConfig, 'NODE_ENV' | 'SHEETS_DRIVER' | 'SHEETS_ALLOW_LIVE' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'PUBLIC_API_URL'>;

export const createSheetsGateway = (env: SheetsEnv, redis: Redis): { gateway: SheetsGateway; fake: FakeSheetsGateway | null } => {
  if (env.SHEETS_DRIVER === 'google') {
    const local = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
    if (local && !env.SHEETS_ALLOW_LIVE) {
      throw new Error('SHEETS_DRIVER=google is refused in development / test: set SHEETS_DRIVER=fake (or SHEETS_ALLOW_LIVE=true if you really mean to call Google)');
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('SHEETS_DRIVER=google needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    return { gateway: new GoogleSheetsGateway(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET), fake: null };
  }
  const fake = new FakeSheetsGateway(redis, env.PUBLIC_API_URL.replace(/\/$/, ''));
  return { gateway: fake, fake };
};
