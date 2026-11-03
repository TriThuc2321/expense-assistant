import 'server-only';
import { z } from 'zod';

import { parseAllowedEmails } from '@/server/auth/allowlist';

// `KEY=` in a .env file yields '', which should count as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_URL: z.url(),

  DATABASE_URL: z.url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ALLOWED_EMAILS: z.string().min(1).transform(parseAllowedEmails),

  // Phase 3 keys: optional until the features that use them land.
  ZALO_BOT_TOKEN: optional(z.string().min(1)),
  // Zalo requires the webhook secret to be 8-256 chars.
  ZALO_WEBHOOK_SECRET: optional(z.string().min(8).max(256)),

  ANTHROPIC_API_KEY: optional(z.string().min(1)),

  R2_ACCOUNT_ID: optional(z.string().min(1)),
  R2_ACCESS_KEY_ID: optional(z.string().min(1)),
  R2_SECRET_ACCESS_KEY: optional(z.string().min(1)),
  R2_BUCKET: optional(z.string().min(1)),

  CRON_SECRET: optional(z.string().min(16)),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Parsed lazily so `next build` and CI don't need real secrets; the first
// server-side call fails fast with every missing/invalid key listed.
export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }

  cached = parsed.data;
  return cached;
}
