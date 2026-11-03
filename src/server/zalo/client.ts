import { zaloApiUrl } from './config';

export async function sendMessage(chatId: string, html: string): Promise<void> {
  try {
    const res = await fetch(zaloApiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'html' }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (body.ok !== true) {
      console.error('zalo sendMessage failed', res.status, body.description);
    }
  } catch (err) {
    console.error(
      'zalo sendMessage error',
      err instanceof Error ? err.name : 'unknown',
    );
  }
}
