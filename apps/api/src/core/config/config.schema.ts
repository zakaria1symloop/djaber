// 01-nest-module-map §5 "Config": zod schema, fails fast on boot, secrets never logged.
import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4010),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PUBLIC_API_URL: z.string().default('http://localhost:4010'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3010'),
  WEB_ORIGINS: z.string().default('http://localhost:3010'),

  // Auth — EdDSA key pair (PKCS8 / SPKI PEM, base64-encoded). Generated on first dev boot when empty.
  JWT_PRIVATE_KEY: z.string().default(''),
  JWT_PUBLIC_KEY: z.string().default(''),
  JWT_ACCESS_TTL_S: z.coerce.number().int().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().default(30),
  // AES-256-GCM key ring: `v1:<base64 32 bytes>,v2:...` (last = current).
  ENCRYPTION_KEYS: z.string().default(''),

  // Storage: `local` (dev/test default) or `s3`
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.local/storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  // Mail: `file` (dev/test default) or `resend`
  MAIL_DRIVER: z.enum(['file', 'resend']).default('file'),
  MAIL_LOCAL_DIR: z.string().default('.local/mail'),
  MAIL_FROM: z.string().default('Djaber <no-reply@djaber.ai>'),
  RESEND_API_KEY: z.string().optional(),

  // Meta
  META_DRIVER: z.enum(['fake', 'graph']).default('fake'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v21.0'),

  // Payments (Chargily is the only gateway, D4)
  PAYMENT_PROVIDER: z.literal('chargily').default('chargily'),
  PAYMENT_DRIVER: z.enum(['fake', 'chargily']).default('fake'),
  CHARGILY_API_KEY: z.string().optional(),
  CHARGILY_SECRET: z.string().optional(),
  CHARGILY_MODE: z.enum(['test', 'live']).default('test'),

  // AI providers (platform keys live in DB `AiProvider`; env only bootstraps them)
  AI_DRIVER: z.enum(['fake', 'live']).default('fake'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Couriers / Google / push / stores
  COURIER_DRIVER: z.enum(['fake', 'live']).default('fake'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SHEETS_DRIVER: z.enum(['fake', 'google']).default('fake'),
  PUSH_DRIVER: z.enum(['fake', 'fcm']).default('fake'),
  FCM_SERVICE_ACCOUNT: z.string().optional(),
  IAP_DRIVER: z.enum(['fake', 'stores']).default('fake'),
  GOOGLE_PLAY_SERVICE_ACCOUNT: z.string().optional(),
  APP_STORE_SHARED_SECRET: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SWAGGER_ENABLED: bool.default(true),
  SEED_ADMIN_EMAIL: z.string().default('admin@djaber.local'),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
