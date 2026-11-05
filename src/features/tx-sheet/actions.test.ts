import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('@/server/auth/session', () => ({
  requireSession: vi.fn(async () => ({ user: { id: 'u1' } })),
}));
vi.mock('@/server/services/categories', () => ({
  listCategories: vi.fn(),
  resolveCategorySlug: vi.fn(),
}));
vi.mock('@/server/services/quick-entry', () => ({
  quickParseToInput: vi.fn(),
}));
vi.mock('@/server/services/transactions', () => ({
  createTransaction: vi.fn(),
  createTransactions: vi.fn(),
  getTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  softDeleteTransactions: vi.fn(),
  updateTransaction: vi.fn(),
}));
vi.mock('@/server/services/receipts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
}));
vi.mock('@/server/ai/parse-text', () => ({ parseText: vi.fn() }));
vi.mock('@/server/ai/parse-receipt', () => ({
  MAX_RECEIPT_ITEMS: 20,
  parseReceipt: vi.fn(),
}));

import type { TxInput, TxView } from '@/server/services/transactions';

import { parseReceipt } from '@/server/ai/parse-receipt';
import { parseText } from '@/server/ai/parse-text';
import {
  listCategories,
  resolveCategorySlug,
} from '@/server/services/categories';
import { quickParseToInput } from '@/server/services/quick-entry';
import {
  createTransaction,
  createTransactions,
  softDeleteTransactions,
} from '@/server/services/transactions';

import {
  createQuickTxAction,
  deleteManyTxAction,
  scanReceiptAction,
} from './actions';
import { MAX_SCAN_BYTES } from './schema';

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const CATEGORIES = [
  { id: 'food', name: 'Ăn uống', type: 'out', children: [] },
] as unknown as Awaited<ReturnType<typeof listCategories>>;
const KEYWORD_INPUT: TxInput = {
  type: 'out',
  amount: 100_000,
  categoryId: 'id:other',
  store: null,
  note: 'xyz',
  date: '2026-11-05',
};

function imageForm(bytes: number[] | Uint8Array) {
  const form = new FormData();
  form.append('image', new File([new Uint8Array(bytes)], 'receipt.jpg'));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listCategories).mockResolvedValue(CATEGORIES);
  vi.mocked(resolveCategorySlug).mockResolvedValue('id:shop.goods');
  vi.mocked(quickParseToInput).mockResolvedValue(KEYWORD_INPUT);
  vi.mocked(createTransaction).mockResolvedValue({ id: 'tx1' } as TxView);
  vi.mocked(createTransactions).mockImplementation(async (_u, inputs) =>
    inputs.map((_, i) => ({ id: `tx${i}` }) as TxView),
  );
});

describe('scanReceiptAction', () => {
  const item = {
    amount: 45_000,
    store: 'Phở 24',
    date: '2026-11-05',
    categoryId: 'food',
    note: null,
  };

  it('rejects an image over the size limit before calling the model', async () => {
    const res = await scanReceiptAction(
      imageForm(new Uint8Array(MAX_SCAN_BYTES + 1)),
    );
    expect(res).toEqual({ ok: false, error: 'invalid_image' });
    expect(parseReceipt).not.toHaveBeenCalled();
  });

  it('rejects bytes that are not an image', async () => {
    const res = await scanReceiptAction(imageForm([1, 2, 3, 4]));
    expect(res).toEqual({ ok: false, error: 'invalid_image' });
    expect(parseReceipt).not.toHaveBeenCalled();
  });

  it('rejects a missing image', async () => {
    const res = await scanReceiptAction(new FormData());
    expect(res).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('saves nothing when the photo is not a receipt', async () => {
    vi.mocked(parseReceipt).mockResolvedValue({ isReceipt: false, items: [] });
    const res = await scanReceiptAction(imageForm(JPEG));
    expect(res).toEqual({ ok: false, error: 'no_total' });
    expect(createTransactions).not.toHaveBeenCalled();
  });

  it('saves every item as an app transaction and returns the ids', async () => {
    vi.mocked(parseReceipt).mockResolvedValue({
      isReceipt: true,
      items: [item, { ...item, amount: 32_000, categoryId: null }],
    });
    const res = await scanReceiptAction(imageForm(JPEG));

    expect(res).toEqual({ ok: true, data: { ids: ['tx0', 'tx1'] } });
    expect(parseReceipt).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      expect.anything(),
    );
    // No third argument: the source defaults to 'app', not 'zalo'.
    expect(createTransactions).toHaveBeenCalledWith('u1', [
      expect.objectContaining({ amount: 45_000, categoryId: 'food' }),
      expect.objectContaining({ amount: 32_000, categoryId: 'id:shop.goods' }),
    ]);
  });
});

describe('createQuickTxAction', () => {
  it('keeps the parsed amount and date when the model refines the category', async () => {
    vi.mocked(parseText).mockResolvedValue({
      type: 'out',
      amount: 999,
      categoryId: 'food',
      store: 'Quán',
      note: 'bún',
      date: '2020-01-01',
    });
    const res = await createQuickTxAction({ text: 'xyz 100k' });

    expect(res.ok).toBe(true);
    expect(createTransaction).toHaveBeenCalledWith('u1', {
      ...KEYWORD_INPUT,
      categoryId: 'food',
      store: 'Quán',
      note: 'bún',
    });
  });

  it('falls back to the keyword result when the model fails', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    vi.mocked(parseText).mockRejectedValue(new Error('down'));
    const res = await createQuickTxAction({ text: 'xyz 100k' });

    expect(res.ok).toBe(true);
    expect(createTransaction).toHaveBeenCalledWith('u1', KEYWORD_INPUT);
  });

  it('does not call the model for a confident keyword match', async () => {
    await createQuickTxAction({ text: 'ăn phở 45k' });
    expect(parseText).not.toHaveBeenCalled();
  });

  it('rejects a question', async () => {
    const res = await createQuickTxAction({
      text: 'Tháng này mình tiêu bao nhiêu cho cà phê?',
    });
    expect(res).toEqual({ ok: false, error: 'invalid_input' });
    expect(createTransaction).not.toHaveBeenCalled();
  });
});

describe('deleteManyTxAction', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('deletes all the ids in one call', async () => {
    const res = await deleteManyTxAction({ ids: [id, id] });
    expect(res.ok).toBe(true);
    expect(softDeleteTransactions).toHaveBeenCalledWith('u1', [id, id]);
  });

  it('rejects more ids than one receipt can produce', async () => {
    const res = await deleteManyTxAction({ ids: Array(21).fill(id) });
    expect(res).toEqual({ ok: false, error: 'invalid_input' });
    expect(softDeleteTransactions).not.toHaveBeenCalled();
  });
});
