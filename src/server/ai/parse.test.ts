import { beforeEach, describe, expect, it, vi } from 'vitest';

const parse = vi.fn();
vi.mock('./client', () => ({
  getOpenAI: () => ({ responses: { parse } }),
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
  it('sends model, low reasoning effort, a json schema format and instructions', async () => {
    parse.mockResolvedValue({ output_parsed: null });
    await parseText('phở 45k', ctx);
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-mini',
        reasoning: { effort: 'low' },
        text: {
          format: expect.objectContaining({ type: 'json_schema' }),
        },
        instructions: expect.any(String),
      }),
    );
    expect(parse.mock.calls[0][0]).not.toHaveProperty('temperature');
  });

  it('takes type from the chosen category', async () => {
    parse.mockResolvedValue({
      output_parsed: {
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

  it('returns null when there is no parsed output', async () => {
    parse.mockResolvedValue({ output_parsed: null });
    await expect(parseText('x', ctx)).resolves.toBeNull();
  });
});

describe('parseReceipt', () => {
  it('sends the image as a data URL before the text', async () => {
    parse.mockResolvedValue({
      output_parsed: {
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
    const content = parse.mock.calls[0][0].input[0].content;
    expect(content[0]).toEqual({
      type: 'input_image',
      detail: 'auto',
      image_url: `data:image/png;base64,${image.toString('base64')}`,
    });
    expect(content[1].type).toBe('input_text');
  });

  it('returns null when there is no parsed output', async () => {
    parse.mockResolvedValue({ output_parsed: null });
    await expect(
      parseReceipt(Buffer.from('a'), 'image/png', ctx),
    ).resolves.toBeNull();
  });
});
