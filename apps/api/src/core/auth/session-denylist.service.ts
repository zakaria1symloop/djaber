// AUTH-04 / ADM users "Déconnecter toutes les sessions": revoking a session (refresh-token family) must also stop its
// access token at once instead of letting it live until expiry (≤ JWT_ACCESS_TTL_S). Revoked family ids are kept in
// Redis for one access-token lifetime; the AuthGuard refuses a token whose `sid` is listed (401 UNAUTHORIZED).
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { RedisService } from '../redis/redis.provider';

const key = (familyId: string) => `auth:revoked-sid:${familyId}`;

@Injectable()
export class SessionDenylistService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async deny(familyIds: string[]): Promise<void> {
    const ids = [...new Set(familyIds.filter(Boolean))];
    if (!ids.length) return;
    // +60 s: a token signed just before the revocation still expires inside the window
    const ttl = this.config.get('JWT_ACCESS_TTL_S') + 60;
    const multi = this.redis.client.multi();
    for (const id of ids) multi.set(key(id), '1', 'EX', ttl);
    await multi.exec();
  }

  async isDenied(familyId: string | undefined): Promise<boolean> {
    if (!familyId) return false;
    return (await this.redis.client.exists(key(familyId))) === 1;
  }
}
