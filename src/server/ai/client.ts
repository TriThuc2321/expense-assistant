import OpenAI from 'openai';

import { env } from '@/configs/env';

let client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  client ??= new OpenAI({ apiKey: env().OPENAI_API_KEY });
  return client;
}
