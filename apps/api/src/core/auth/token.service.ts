// CLAUDE.md rule 9: EdDSA JWT, 15 min access token. Claims per 00-build-order §0: { sub, wid?, role?, pr, imp?, iat, exp }.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exportPKCS8, exportSPKI, generateKeyPair, importPKCS8, importSPKI, jwtVerify, SignJWT, type KeyLike } from 'jose';
import { ConfigService } from '../config/config.service';
import { fromRepoRoot } from '../config/repo-root';

export type AccessClaims = {
  sub: string;
  wid?: string;
  role?: string;
  pr: string;
  imp?: string;
  /** refresh-token family of the session that issued this access token (session list / logout) */
  sid?: string;
  iat: number;
  exp: number;
};

@Injectable()
export class TokenService implements OnModuleInit {
  private privateKey!: KeyLike;
  private publicKey!: KeyLike;
  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    let priv = this.config.get('JWT_PRIVATE_KEY');
    let pub = this.config.get('JWT_PUBLIC_KEY');
    if (priv && pub) {
      priv = Buffer.from(priv, 'base64').toString('utf8');
      pub = Buffer.from(pub, 'base64').toString('utf8');
    } else {
      if (this.config.isProd) throw new Error('JWT_PRIVATE_KEY / JWT_PUBLIC_KEY are required');
      // dev / test: generate once and keep under .local/keys (git-ignored)
      const dir = fromRepoRoot(this.config.isTest ? '.local/test-keys' : '.local/keys');
      const privFile = resolve(dir, 'jwt.key');
      const pubFile = resolve(dir, 'jwt.pub');
      if (existsSync(privFile) && existsSync(pubFile)) {
        priv = readFileSync(privFile, 'utf8');
        pub = readFileSync(pubFile, 'utf8');
      } else {
        const pair = await generateKeyPair('EdDSA', { extractable: true });
        priv = await exportPKCS8(pair.privateKey);
        pub = await exportSPKI(pair.publicKey);
        mkdirSync(dir, { recursive: true });
        writeFileSync(privFile, priv);
        writeFileSync(pubFile, pub);
      }
    }
    this.privateKey = await importPKCS8(priv, 'EdDSA');
    this.publicKey = await importSPKI(pub, 'EdDSA');
  }

  async signAccess(claims: Omit<AccessClaims, 'iat' | 'exp'>): Promise<{ token: string; expiresAt: Date }> {
    const ttl = this.config.get('JWT_ACCESS_TTL_S');
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .sign(this.privateKey);
    return { token, expiresAt: new Date((now + ttl) * 1000) };
  }

  /** Short-lived purpose tokens (mfa step, e-mail links are opaque DB tokens instead). */
  async signPurpose(purpose: string, payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ ...payload, purpose })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .sign(this.privateKey);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    const { payload } = await jwtVerify(token, this.publicKey, { algorithms: ['EdDSA'] });
    if (typeof payload.sub !== 'string' || payload.purpose) throw new Error('invalid token');
    return payload as unknown as AccessClaims;
  }

  async verifyPurpose<T extends Record<string, unknown>>(token: string, purpose: string): Promise<T> {
    const { payload } = await jwtVerify(token, this.publicKey, { algorithms: ['EdDSA'] });
    if (payload.purpose !== purpose) throw new Error('invalid purpose');
    return payload as unknown as T;
  }
}
