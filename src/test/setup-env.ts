const defaults: Record<string, string> = {
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-better-auth-secret-0123456789ab',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  ALLOWED_EMAILS: 'test@example.com',
  ZALO_BOT_TOKEN: 'test-zalo-bot-token',
  ZALO_WEBHOOK_SECRET: 'test-zalo-webhook-secret',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  R2_ACCOUNT_ID: 'test-r2-account',
  R2_ACCESS_KEY_ID: 'test-r2-access-key',
  R2_SECRET_ACCESS_KEY: 'test-r2-secret',
  R2_BUCKET: 'test-bucket',
  CRON_SECRET: 'test-cron-secret-0123456789',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/expense_test';
