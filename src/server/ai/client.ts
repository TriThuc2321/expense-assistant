import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/configs/env';

let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}
