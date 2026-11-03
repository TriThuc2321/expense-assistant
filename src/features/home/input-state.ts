import { type QuickParse, isQuestion, parseQuick } from '@/lib/parse-quick';

export type InputState =
  | { kind: 'empty' }
  | { kind: 'question' }
  | { kind: 'unparseable' }
  | { kind: 'parsed'; parsed: QuickParse };

export function inputState(text: string, today: string): InputState {
  if (text.trim() === '') return { kind: 'empty' };
  if (isQuestion(text)) return { kind: 'question' };
  const parsed = parseQuick(text, today);
  return parsed ? { kind: 'parsed', parsed } : { kind: 'unparseable' };
}
