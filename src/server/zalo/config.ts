import { env } from '@/configs/env';

export const ZALO_BOT_NAME = 'Sổ Chi';
export const ZALO_API_BASE = 'https://bot-api.zaloplatforms.com';

export function zaloApiUrl(method: string): string {
  return `${ZALO_API_BASE}/bot${env().ZALO_BOT_TOKEN}/${method}`;
}
