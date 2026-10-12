// Picks the courier driver. SAFETY: `COURIER_DRIVER=live` is refused in development / test unless
// `COURIER_ALLOW_LIVE=true` (no real parcel may be created from a developer machine or a test run); tests always fake.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../../core/config/config.service';
import type { AppConfig } from '../../../core/config/config.schema';
import type { CourierAdapter, CourierProvider } from './courier-adapter';
import { EcotrackAdapter } from './ecotrack.adapter';
import { FakeCourierAdapter, FakeCourierBackend } from './fake-courier';
import { fetchTransport, type CourierTransport } from './http';
import { ManualAdapter } from './manual.adapter';
import { YalidineAdapter } from './yalidine.adapter';
import { ZrExpressAdapter } from './zrexpress.adapter';

type CourierEnv = Pick<AppConfig, 'NODE_ENV' | 'COURIER_DRIVER' | 'COURIER_ALLOW_LIVE'>;

export const createCourierAdapters = (env: CourierEnv, transport: CourierTransport = fetchTransport()) => {
  const fake = new FakeCourierBackend();
  const manual = new ManualAdapter();
  if (env.COURIER_DRIVER !== 'live') {
    return { driver: 'fake' as const, fake, adapters: { zrexpress: new FakeCourierAdapter('zrexpress', fake), ecotrack: new FakeCourierAdapter('ecotrack', fake), yalidine: new FakeCourierAdapter('yalidine', fake), manual } as Record<CourierProvider, CourierAdapter> };
  }
  const local = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  if (local && !env.COURIER_ALLOW_LIVE) {
    throw new Error('COURIER_DRIVER=live is refused in development / test: set COURIER_DRIVER=fake (or COURIER_ALLOW_LIVE=true if you really mean to create real parcels)');
  }
  return { driver: 'live' as const, fake, adapters: { zrexpress: new ZrExpressAdapter(transport), ecotrack: new EcotrackAdapter(transport), yalidine: new YalidineAdapter(transport), manual } as Record<CourierProvider, CourierAdapter> };
};

@Injectable()
export class CourierAdapters {
  readonly driver: 'fake' | 'live';
  /** the fake backend (scripting in tests and in the dev simulator); unused with the live driver */
  readonly fake: FakeCourierBackend;
  private readonly adapters: Record<CourierProvider, CourierAdapter>;

  constructor(config: ConfigService) {
    const r = createCourierAdapters(config.all);
    this.driver = r.driver;
    this.fake = r.fake;
    this.adapters = r.adapters;
    new Logger('CourierAdapters').log(`courier adapters: ${r.driver}`);
  }

  get(provider: CourierProvider | string): CourierAdapter {
    const a = this.adapters[provider as CourierProvider];
    if (!a) throw new Error(`unknown courier provider ${provider}`);
    return a;
  }
}
