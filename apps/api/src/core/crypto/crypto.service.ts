// CLAUDE.md rule 9: AES-256-GCM for stored third-party credentials, argon2id for passwords, SHA-256 for opaque tokens.
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '../config/config.service';

@Injectable()
export class CryptoService {
  private readonly keys = new Map<string, Buffer>();
  private readonly current: string;

  constructor(config: ConfigService) {
    let ring = config.get('ENCRYPTION_KEYS');
    if (!ring) {
      if (config.isProd) throw new Error('ENCRYPTION_KEYS is required');
      // dev / test: one generated key kept under .local/keys (git-ignored)
      const dir = resolve(process.cwd(), config.isTest ? '.local/test-keys' : '../../.local/keys');
      const file = resolve(dir, 'encryption.keys');
      if (existsSync(file)) ring = readFileSync(file, 'utf8').trim();
      else {
        ring = `v1:${randomBytes(32).toString('base64')}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, ring);
      }
    }
    let last = '';
    for (const part of ring.split(',')) {
      const i = part.indexOf(':');
      const id = part.slice(0, i).trim();
      const key = Buffer.from(part.slice(i + 1).trim(), 'base64');
      if (!id || key.length !== 32) throw new Error('ENCRYPTION_KEYS: each entry must be <id>:<base64 32 bytes>');
      this.keys.set(id, key);
      last = id;
    }
    this.current = last;
  }

  /** → `<keyId>.<iv>.<tag>.<ciphertext>` (base64url parts). */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.get(this.current)!, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [this.current, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }

  decrypt(payload: string): string {
    const [id, iv, tag, data] = payload.split('.');
    const key = id ? this.keys.get(id) : undefined;
    if (!key || !iv || !tag || data === undefined) throw new Error('decrypt: unknown key or malformed payload');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }
  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Opaque random token (URL-safe) and its SHA-256 for storage. */
  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }
  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  hmacSha256(secret: string, value: string | Buffer): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }
  safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
