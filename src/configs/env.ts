import 'server-only';
import { z } from 'zod';

// An empty `AI_DAILY_LIMIT=` line in .env files means unset, not 0.
export const aiDailyLimit = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.coerce.number().int().positive().default(100),
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_URL: z.url(),

  DATABASE_URL: z.url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  ZALO_BOT_TOKEN: z.string().min(1),
  // Zalo requires the webhook secret to be 8-256 chars.
  ZALO_WEBHOOK_SECRET: z.string().min(8).max(256),

  OPENAI_API_KEY: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),

  CRON_SECRET: z.string().min(16),

  AI_DAILY_LIMIT: aiDailyLimit,
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
