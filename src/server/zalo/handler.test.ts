import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryNode } from '@/server/services/categories';
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
  undoLatestZaloTransaction,
} from '@/server/services/transactions';
import {
  findAllowedUserIdByZaloId,
  redeemLinkCode,
} from '@/server/services/zalo-link';

import type { ZaloUpdate } from './update';

import { sendMessage } from './client';
import { downloadImage } from './download';
import { handleZaloUpdate } from './handler';
import {
  REPLY,
  confirmManyReply,
  confirmReply,
  linkedReply,
  undoneReply,
} from './replies';

vi.mock('./client', () => ({ sendMessage: vi.fn() }));
vi.mock('./download', () => ({ downloadImage: vi.fn() }));
vi.mock('@/server/services/zalo-link', () => ({
  redeemLinkCode: vi.fn(),
  findAllowedUserIdByZaloId: vi.fn(),
}));
vi.mock('@/server/services/transactions', () => ({
  createTransaction: vi.fn(),
  createTransactions: vi.fn(),
  undoLatestZaloTransaction: vi.fn(),
}));
vi.mock('@/server/services/quick-entry', () => ({
  quickParseToInput: vi.fn(),
}));
vi.mock('@/server/services/categories', () => ({
  listCategories: vi.fn(),
  resolveCategorySlug: vi.fn(),
}));
vi.mock('@/server/services/receipts', () => ({
  MAX_CLAUDE_IMAGE_BYTES: 5 * 1024 * 1024,
}));
vi.mock('@/server/ai/parse-text', () => ({ parseText: vi.fn() }));
vi.mock('@/server/ai/parse-receipt', () => ({ parseReceipt: vi.fn() }));

const NOW = new Date('2026-11-03T05:00:00Z');
const TODAY = '2026-11-03';
const USER = 'user-1';
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

const CATEGORIES: CategoryNode[] = [
  {
    id: 'root-food',
    name: 'Ăn uống',
    type: 'out',
    children: [{ id: 'cat-food', name: 'Ăn trưa', type: 'out' }],
  },
  {
    id: 'root-income',
    name: 'Thu nhập',
    type: 'in',
    children: [{ id: 'cat-refund', name: 'Hoàn tiền', type: 'in' }],
  },
] as unknown as CategoryNode[];

function update(over: Partial<ZaloUpdate> = {}): ZaloUpdate {
  return {
    messageId: 'm1',
    chatId: 'C',
    chatType: 'PRIVATE',
    fromId: 'F',
    fromName: 'Thục',
    event: 'text',
    text: 'ăn phở 45k',
    photoUrl: null,
    ...over,
  };
}

function view(input: TxInput, receiptKey: string | null = null): TxView {
  return {
    id: 'tx-1',
    ...input,
    source: 'zalo',
    receiptKey,
    createdAt: NOW,
    category: {
      id: input.categoryId,
      name: 'Ăn sáng',
      parentName: 'Ăn uống',
      icon: 'utensils',
      color: 'orange',
    },
  };
}

function sent(): [string, string][] {
  return vi.mocked(sendMessage).mock.calls as [string, string][];
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findAllowedUserIdByZaloId).mockResolvedValue(USER);
  vi.mocked(quickParseToInput).mockImplementation(async (_userId, p) => ({
    type: p.type,
    amount: p.amount,
    categoryId: `id:${p.categorySlug}`,
    store: p.store,
    note: p.note,
    date: p.date,
  }));
  vi.mocked(createTransaction).mockImplementation(
    async (_userId, input, _source, receiptKey) => view(input, receiptKey),
  );
  vi.mocked(createTransactions).mockImplementation(async (_userId, inputs) =>
    inputs.map((input, i) => ({ ...view(input), id: `tx-${i + 1}` })),
  );
  vi.mocked(listCategories).mockResolvedValue(CATEGORIES);
  vi.mocked(resolveCategorySlug).mockResolvedValue('id:shop.goods');
  vi.mocked(downloadImage).mockResolvedValue({
    ok: true,
    bytes: JPEG,
    mediaType: 'image/jpeg',
  });
});

describe('handleZaloUpdate', () => {
  it('links by from.id and replies to chat.id', async () => {
    vi.mocked(redeemLinkCode).mockResolvedValue({
      userId: USER,
      userName: 'Thục',
    });

    await handleZaloUpdate(update({ text: '/link abc123' }), NOW);

    expect(redeemLinkCode).toHaveBeenCalledWith(
      { code: 'abc123', zaloUserId: 'F', displayName: 'Thục' },
      NOW,
    );
    expect(sent()).toEqual([['C', linkedReply('Thục')]]);
  });

  it('refuses /link in a group', async () => {
    await handleZaloUpdate(
      update({ chatType: 'GROUP', text: '@Sổ Chi /link ABC123' }),
      NOW,
    );

    expect(redeemLinkCode).not.toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.linkInGroup]]);
  });

  it('replies invalidCode for a bad code', async () => {
    vi.mocked(redeemLinkCode).mockResolvedValue(null);

    await handleZaloUpdate(update({ text: '/link NOPE' }), NOW);

    expect(sent()).toEqual([['C', REPLY.invalidCode]]);
  });

  it('asks unlinked users to link first', async () => {
    vi.mocked(findAllowedUserIdByZaloId).mockResolvedValue(null);

    await handleZaloUpdate(update({ fromId: 'stranger' }), NOW);

    expect(findAllowedUserIdByZaloId).toHaveBeenCalledWith('stranger');
    expect(createTransaction).not.toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.notLinked]]);
  });

  it('treats a linked user removed from the allowlist as not linked', async () => {
    vi.mocked(findAllowedUserIdByZaloId).mockResolvedValue(null);

    await handleZaloUpdate(update({ text: 'ăn phở 45k' }), NOW);

    expect(findAllowedUserIdByZaloId).toHaveBeenCalledWith('F');
    expect(createTransaction).not.toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.notLinked]]);
  });

  it('undoes or reports nothing to undo', async () => {
    const tx = view({
      type: 'out',
      amount: 45000,
      categoryId: 'cat-food',
      store: null,
      note: 'Ăn phở',
      date: TODAY,
    });
    vi.mocked(undoLatestZaloTransaction).mockResolvedValueOnce([tx]);
    vi.mocked(undoLatestZaloTransaction).mockResolvedValueOnce([]);

    await handleZaloUpdate(update({ text: '/undo' }), NOW);
    await handleZaloUpdate(update({ text: '/undo' }), NOW);

    expect(undoLatestZaloTransaction).toHaveBeenCalledWith(USER, NOW);
    expect(sent()).toEqual([
      ['C', undoneReply([tx])],
      ['C', REPLY.nothingToUndo],
    ]);
  });

  it('creates a high-confidence text tx without calling Claude', async () => {
    await handleZaloUpdate(update({ text: 'ăn phở 45k' }), NOW);

    expect(parseText).not.toHaveBeenCalled();
    expect(listCategories).not.toHaveBeenCalled();
    const input: TxInput = {
      type: 'out',
      amount: 45000,
      categoryId: 'id:food.breakfast',
      store: null,
      note: 'Ăn phở',
      date: TODAY,
    };
    expect(createTransaction).toHaveBeenCalledWith(USER, input, 'zalo');
    expect(sent()).toEqual([['C', confirmReply(view(input), TODAY)]]);
  });

  it('uses Claude category/store/note for low confidence but keeps parsed amount and date', async () => {
    vi.mocked(parseText).mockResolvedValue({
      type: 'in',
      amount: 999,
      categoryId: 'cat-refund',
      store: 'Tiki',
      note: 'Hoàn tiền đơn hàng',
      date: '2026-10-01',
    });

    await handleZaloUpdate(update({ text: 'hôm qua món lạ 120k' }), NOW);

    expect(parseText).toHaveBeenCalledWith('hôm qua món lạ 120k', {
      today: TODAY,
      categories: [
        {
          id: 'cat-food',
          name: 'Ăn trưa',
          parentName: 'Ăn uống',
          type: 'out',
        },
        {
          id: 'cat-refund',
          name: 'Hoàn tiền',
          parentName: 'Thu nhập',
          type: 'in',
        },
      ],
    });
    const input: TxInput = {
      type: 'in',
      amount: 120000,
      categoryId: 'cat-refund',
      store: 'Tiki',
      note: 'Hoàn tiền đơn hàng',
      date: '2026-11-02',
    };
    expect(createTransaction).toHaveBeenCalledWith(USER, input, 'zalo');
    expect(sent()).toEqual([['C', confirmReply(view(input), TODAY)]]);
  });

  it('falls back to the parsed category when Claude fails or refuses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(parseText).mockRejectedValueOnce(new Error('overloaded'));
    vi.mocked(parseText).mockResolvedValueOnce(null);

    await handleZaloUpdate(update({ text: 'món lạ 120k' }), NOW);
    await handleZaloUpdate(update({ text: 'món lạ 120k' }), NOW);

    const input: TxInput = {
      type: 'out',
      amount: 120000,
      categoryId: 'id:shop.goods',
      store: null,
      note: 'Món lạ',
      date: TODAY,
    };
    expect(createTransaction).toHaveBeenNthCalledWith(1, USER, input, 'zalo');
    expect(createTransaction).toHaveBeenNthCalledWith(2, USER, input, 'zalo');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(sent().map(([, html]) => html)).not.toContain(REPLY.error);
    errorSpy.mockRestore();
  });

  it('keeps the parsed input when the user has no categories for Claude', async () => {
    vi.mocked(listCategories).mockResolvedValue([]);

    await handleZaloUpdate(update({ text: 'món lạ 120k' }), NOW);

    expect(parseText).not.toHaveBeenCalled();
    expect(createTransaction).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ amount: 120000, categoryId: 'id:shop.goods' }),
      'zalo',
    );
  });

  it('answers mention-only text with the syntax hint and questions with qaSoon', async () => {
    await handleZaloUpdate(update({ chatType: 'GROUP', text: '@Sổ Chi' }), NOW);
    await handleZaloUpdate(update({ text: 'tháng này tiêu bao nhiêu?' }), NOW);

    expect(createTransaction).not.toHaveBeenCalled();
    expect(sent()).toEqual([
      ['C', REPLY.noAmount],
      ['C', REPLY.qaSoon],
    ]);
  });

  it('creates a receipt tx without storing the image', async () => {
    vi.mocked(parseReceipt).mockResolvedValue({
      isReceipt: true,
      items: [
        {
          amount: 85000,
          store: 'Phở Thìn',
          date: '2026-11-01',
          categoryId: 'cat-food',
          note: 'Phở bò, trà đá ×2',
        },
      ],
    });

    await handleZaloUpdate(
      update({
        event: 'image',
        text: null,
        photoUrl: 'https://img.zalo.me/r.jpg',
      }),
      NOW,
    );

    expect(downloadImage).toHaveBeenCalledWith('https://img.zalo.me/r.jpg');
    expect(parseReceipt).toHaveBeenCalledWith(
      JPEG,
      'image/jpeg',
      expect.objectContaining({ today: TODAY }),
    );
    const input: TxInput = {
      type: 'out',
      amount: 85000,
      categoryId: 'cat-food',
      store: 'Phở Thìn',
      note: 'Phở bò, trà đá ×2',
      date: '2026-11-01',
    };
    expect(createTransactions).toHaveBeenCalledWith(USER, [input], 'zalo');
    expect(sent()).toEqual([
      [
        'C',
        confirmReply({ ...view(input), id: 'tx-1' }, TODAY, {
          note: 'Phở bò, trà đá ×2',
        }),
      ],
    ]);
  });

  it('files a receipt without a category under shop.goods', async () => {
    vi.mocked(parseReceipt).mockResolvedValue({
      isReceipt: true,
      items: [
        {
          amount: 30000,
          store: null,
          date: TODAY,
          categoryId: null,
          note: null,
        },
      ],
    });

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    expect(resolveCategorySlug).toHaveBeenCalledWith(USER, 'shop.goods', 'out');
    expect(createTransactions).toHaveBeenCalledWith(
      USER,
      [
        {
          type: 'out',
          amount: 30000,
          categoryId: 'id:shop.goods',
          store: null,
          note: null,
          date: TODAY,
        },
      ],
      'zalo',
    );
  });

  it('replies noTotal when the photo is not a receipt', async () => {
    vi.mocked(parseReceipt).mockResolvedValueOnce({
      isReceipt: false,
      items: [],
    });
    vi.mocked(parseReceipt).mockResolvedValueOnce({
      isReceipt: true,
      items: [
        {
          amount: 0.4,
          store: null,
          date: TODAY,
          categoryId: 'cat-food',
          note: null,
        },
      ],
    });
    vi.mocked(parseReceipt).mockResolvedValueOnce(null);

    for (let i = 0; i < 3; i++) {
      await handleZaloUpdate(
        update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
        NOW,
      );
    }

    expect(createTransactions).not.toHaveBeenCalled();
    expect(sent()).toEqual([
      ['C', REPLY.noTotal],
      ['C', REPLY.noTotal],
      ['C', REPLY.noTotal],
    ]);
  });

  it('records every transfer in a multi-transfer screenshot', async () => {
    vi.mocked(parseReceipt).mockResolvedValue({
      isReceipt: true,
      items: [
        {
          amount: 150000,
          store: 'Nguyễn Văn A',
          date: '2026-11-02',
          categoryId: 'cat-food',
          note: 'tien com',
        },
        {
          amount: 500000,
          store: 'Trần Thị B',
          date: '2026-11-02',
          categoryId: 'cat-refund',
          note: 'tra tien',
        },
        {
          amount: 0,
          store: 'Số dư',
          date: TODAY,
          categoryId: null,
          note: null,
        },
        {
          amount: 20000.6,
          store: null,
          date: TODAY,
          categoryId: null,
          note: 'gửi xe',
        },
      ],
    });

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    const inputs: TxInput[] = [
      {
        type: 'out',
        amount: 150000,
        categoryId: 'cat-food',
        store: 'Nguyễn Văn A',
        note: 'tien com',
        date: '2026-11-02',
      },
      {
        type: 'in',
        amount: 500000,
        categoryId: 'cat-refund',
        store: 'Trần Thị B',
        note: 'tra tien',
        date: '2026-11-02',
      },
      {
        type: 'out',
        amount: 20001,
        categoryId: 'id:shop.goods',
        store: null,
        note: 'gửi xe',
        date: TODAY,
      },
    ];
    expect(createTransactions).toHaveBeenCalledTimes(1);
    expect(createTransactions).toHaveBeenCalledWith(USER, inputs, 'zalo');
    const views = inputs.map((input, i) => ({
      ...view(input),
      id: `tx-${i + 1}`,
    }));
    expect(sent()).toEqual([['C', confirmManyReply(views, TODAY)]]);
  });

  it('undoes every transaction from the latest image', async () => {
    const txs = [
      view({
        type: 'out',
        amount: 150000,
        categoryId: 'cat-food',
        store: 'A',
        note: null,
        date: TODAY,
      }),
      view({
        type: 'in',
        amount: 500000,
        categoryId: 'cat-refund',
        store: 'B',
        note: null,
        date: TODAY,
      }),
    ];
    vi.mocked(undoLatestZaloTransaction).mockResolvedValue(txs);

    await handleZaloUpdate(update({ text: '/undo' }), NOW);

    expect(sent()).toEqual([['C', undoneReply(txs)]]);
  });

  it('skips Claude when the user has no categories', async () => {
    vi.mocked(listCategories).mockResolvedValue([]);

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    expect(parseReceipt).not.toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.noTotal]]);
  });

  it('cuts long Claude store/note to 200 chars and rounds the total', async () => {
    const longNote = 'n'.repeat(300);
    vi.mocked(parseReceipt).mockResolvedValue({
      isReceipt: true,
      items: [
        {
          amount: 45000.4,
          store: `  ${'s'.repeat(250)}  `,
          date: TODAY,
          categoryId: 'cat-food',
          note: longNote,
        },
      ],
    });

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    const input: TxInput = {
      type: 'out',
      amount: 45000,
      categoryId: 'cat-food',
      store: 's'.repeat(200),
      note: 'n'.repeat(200),
      date: TODAY,
    };
    expect(createTransactions).toHaveBeenCalledWith(USER, [input], 'zalo');
    expect(sent()).toEqual([
      [
        'C',
        confirmReply({ ...view(input), id: 'tx-1' }, TODAY, {
          note: 'n'.repeat(200),
        }),
      ],
    ]);
  });

  it('cuts long Claude store/note in the low-confidence text merge', async () => {
    vi.mocked(parseText).mockResolvedValue({
      type: 'out',
      amount: 120000,
      categoryId: 'cat-food',
      store: '   ',
      note: 'x'.repeat(300),
      date: TODAY,
    });

    await handleZaloUpdate(update({ text: 'món lạ 120k' }), NOW);

    expect(createTransaction).toHaveBeenCalledWith(
      USER,
      {
        type: 'out',
        amount: 120000,
        categoryId: 'cat-food',
        store: null,
        note: 'x'.repeat(200),
        date: TODAY,
      },
      'zalo',
    );
  });

  it('refuses images too large for Claude', async () => {
    vi.mocked(downloadImage).mockResolvedValue({
      ok: true,
      bytes: Buffer.alloc(5 * 1024 * 1024 + 1),
      mediaType: 'image/jpeg',
    });

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    expect(parseReceipt).not.toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.imageError]]);
  });

  it('replies the generic error when saving the receipt tx fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(parseReceipt).mockResolvedValue({
      isReceipt: true,
      items: [
        {
          amount: 85000,
          store: null,
          date: TODAY,
          categoryId: 'cat-food',
          note: null,
        },
      ],
    });
    vi.mocked(createTransactions).mockRejectedValue(
      new Error('read-back failed'),
    );

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    expect(createTransactions).toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.error]]);
    errorSpy.mockRestore();
  });

  it('replies imageError when download fails', async () => {
    vi.mocked(downloadImage).mockResolvedValue({ ok: false, error: 'failed' });

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    expect(sent()).toEqual([['C', REPLY.imageError]]);
  });

  it('refuses non-https photo urls without downloading', async () => {
    for (const photoUrl of [
      'http://169.254.169.254/latest',
      'file:///etc/passwd',
      'not a url',
    ]) {
      await handleZaloUpdate(
        update({ event: 'image', text: null, photoUrl }),
        NOW,
      );
    }

    expect(downloadImage).not.toHaveBeenCalled();
    expect(sent()).toEqual([
      ['C', REPLY.imageError],
      ['C', REPLY.imageError],
      ['C', REPLY.imageError],
    ]);
  });

  it('replies the generic error when the DB throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createTransaction).mockRejectedValue(new Error('db down'));

    await expect(handleZaloUpdate(update(), NOW)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(sent()).toEqual([['C', REPLY.error]]);
    errorSpy.mockRestore();
  });

  it('replies the generic error when receipt parsing throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(parseReceipt).mockRejectedValue(new Error('api down'));

    await handleZaloUpdate(
      update({ event: 'image', text: null, photoUrl: 'https://x/r.jpg' }),
      NOW,
    );

    expect(sent()).toEqual([['C', REPLY.error]]);
    errorSpy.mockRestore();
  });

  it('replies the generic error when redeem throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(redeemLinkCode).mockRejectedValue(new Error('unique violation'));

    await handleZaloUpdate(update({ text: '/link ABC123' }), NOW);

    expect(sent()).toEqual([['C', REPLY.error]]);
    errorSpy.mockRestore();
  });

  it('ignores stickers silently', async () => {
    await handleZaloUpdate(update({ event: 'other', text: null }), NOW);

    expect(findAllowedUserIdByZaloId).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
