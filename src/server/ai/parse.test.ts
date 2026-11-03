import { beforeEach, describe, expect, it, vi } from 'vitest';

const parse = vi.fn();
vi.mock('./client', () => ({
  getAnthropic: () => ({ beta: { messages: { parse } } }),
}));

import type { AiCategory } from './categories';

import { parseReceipt } from './parse-receipt';
import { parseText } from './parse-text';

const categories: AiCategory[] = [
  { id: 'pho', name: 'Phở', parentName: 'Ăn uống', type: 'out' },
  { id: 'salary', name: 'Lương', parentName: null, type: 'in' },
];
const ctx = { today: '2026-10-14', categories };

beforeEach(() => parse.mockReset());

describe('parseText', () => {
  it('sends model, low effort, default fallbacks and the beta', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: null });
    await parseText('phở 45k', ctx);
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-5-5',
        fallbacks: 'default',
        betas: ['server-side-fallback-2026-07-01'],
        output_config: expect.objectContaining({ effort: 'low' }),
      }),
    );
    const args = parse.mock.calls[0][0];
    expect(args).not.toHaveProperty('thinking');
    expect(args).not.toHaveProperty('temperature');
  });

  it('takes type from the chosen category', async () => {
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        amount: 15000000,
        categoryId: 'salary',
        store: null,
        note: 'lương tháng 10',
        date: '2026-12-01',
      },
    });
    await expect(parseText('lương 15tr', ctx)).resolves.toEqual({
      type: 'in',
      amount: 15000000,
      categoryId: 'salary',
      store: null,
      note: 'lương tháng 10',
      date: '2026-10-14',
    });
  });

  it('returns null on refusal and on missing parsed_output', async () => {
    parse.mockResolvedValueOnce({
      stop_reason: 'refusal',
      parsed_output: null,
    });
    await expect(parseText('x', ctx)).resolves.toBeNull();
    parse.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      parsed_output: null,
    });
    await expect(parseText('x', ctx)).resolves.toBeNull();
  });
});

describe('parseReceipt', () => {
  it('sends the image as base64 before the text', async () => {
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        isReceipt: true,
        total: 90000,
        store: 'Phở 24',
        date: '2026-10-13',
        categoryId: 'pho',
        note: 'Phở bò',
      },
    });
    const image = Buffer.from('abc');
    const result = await parseReceipt(image, 'image/png', ctx);
    expect(result).toEqual({
      isReceipt: true,
      total: 90000,
      store: 'Phở 24',
      date: '2026-10-13',
      categoryId: 'pho',
      note: 'Phở bò',
    });
    const content = parse.mock.calls[0][0].messages[0].content;
    expect(content[0]).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: image.toString('base64'),
      },
    });
    expect(content[1].type).toBe('text');
  });

  it('returns null on refusal', async () => {
    parse.mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    await expect(
      parseReceipt(Buffer.from('a'), 'image/png', ctx),
    ).resolves.toBeNull();
  });
});
