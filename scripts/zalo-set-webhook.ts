export {};

const { ZALO_BOT_TOKEN, ZALO_WEBHOOK_SECRET, DEV_TUNNEL_HOST } = process.env;

const base =
  process.argv[2] ?? (DEV_TUNNEL_HOST && `https://${DEV_TUNNEL_HOST}`);

if (!ZALO_BOT_TOKEN || !ZALO_WEBHOOK_SECRET || !base) {
  console.error(
    'Missing config: need ZALO_BOT_TOKEN and ZALO_WEBHOOK_SECRET in .env.local, plus DEV_TUNNEL_HOST or a base URL argument.',
  );
  process.exit(1);
}

const url = `${base.replace(/\/+$/, '')}/api/zalo/webhook`;

const response = await fetch(
  `https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/setWebhook`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, secret_token: ZALO_WEBHOOK_SECRET }),
  },
);
const data = (await response.json().catch(() => null)) as {
  ok?: boolean;
  result?: { verification?: unknown };
  description?: string;
} | null;

if (data?.ok !== true) {
  console.error(
    `setWebhook failed (HTTP ${response.status}): ${data?.description ?? 'no description'}`,
  );
  process.exit(1);
}

console.info(`Webhook set: ${url}`);
console.info('verification:', data.result?.verification);
