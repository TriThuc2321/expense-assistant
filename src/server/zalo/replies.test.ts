import { describe, expect, it } from 'vitest';

import type { TxView } from '@/server/services/transactions';

import { confirmReply, linkedReply, undoneReply } from './replies';

const TODAY = '2026-10-14';

function tx(
  over: Partial<TxView> = {},
  category: Partial<TxView['category']> = {},
): TxView {
  return {
    id: 't1',
    type: 'out',
    amount: 45000,
    date: TODAY,
    store: null,
    note: null,
    source: 'zalo',
    receiptKey: null,
    createdAt: new Date(),
    category: {
      id: 'c1',
      name: 'Ăn sáng',
      parentName: 'Ăn uống',
      icon: 'x',
      color: '#000',
      ...category,
    },
    ...over,
  };
}

describe('replies', () => {
  it('formats the confirm reply', () => {
    expect(confirmReply(tx(), TODAY)).toBe(
      '<p>✓ Ăn uống › Ăn sáng · <b>−45.000 ₫</b> · Hôm nay</p><p>Gõ <b>/undo</b> để hủy</p>',
    );
  });

  it('formats income and root-only categories', () => {
    const html = confirmReply(
      tx(
        { type: 'in', date: '2026-10-13' },
        { name: 'Lương', parentName: null },
      ),
      TODAY,
      { note: 'tháng 10' },
    );
    expect(html).toBe(
      '<p>✓ Lương · <b>+45.000 ₫</b> · Hôm qua</p><p><i>tháng 10</i></p><p>Gõ <b>/undo</b> để hủy</p>',
    );
  });

  it('formats undone and linked replies', () => {
    expect(undoneReply(tx({ note: 'phở' }))).toBe(
      '<p>↩ Đã hủy: phở · <b>−45.000 ₫</b></p>',
    );
    expect(undoneReply(tx())).toBe(
      '<p>↩ Đã hủy: Ăn sáng · <b>−45.000 ₫</b></p>',
    );
    expect(linkedReply('Thức')).toBe(
      '<p>✓ Đã liên kết với Sổ Chi của <b>Thức</b>.</p><p>Thử nhắn: <b>ăn phở 45k</b></p>',
    );
  });

  it('escapes user text in html replies', () => {
    const html = confirmReply(tx(), TODAY, { note: '<b>x</b> & <script>' });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; &lt;script&gt;');
    expect(html).not.toContain('<script');
    expect(linkedReply('<i>"a"</i>')).toContain(
      '&lt;i&gt;&quot;a&quot;&lt;/i&gt;',
    );
  });

  it('keeps a reply with 120-char fields under 2000 chars', () => {
    const long = '&'.repeat(500);
    const html = confirmReply(
      tx({ note: long }, { name: long, parentName: long }),
      TODAY,
      { note: long },
    );
    expect(html.length).toBeLessThan(2000);
    expect(undoneReply(tx({ note: long })).length).toBeLessThan(2000);
    expect(linkedReply(long).length).toBeLessThan(2000);
  });
});
