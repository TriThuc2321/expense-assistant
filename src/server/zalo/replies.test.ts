import { describe, expect, it } from 'vitest';

import type { TxView } from '@/server/services/transactions';

import {
  confirmManyReply,
  confirmReply,
  linkedReply,
  undoneReply,
} from './replies';

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
      '<p><b style="color:#15a85f">✓</b> <b>Ăn uống › Ăn sáng</b></p><p><b style="color:#db342e">−45.000 ₫</b> · Hôm nay</p><p><i>Gõ <b>/undo</b> để hủy</i></p>',
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
      '<p><b style="color:#15a85f">✓</b> <b>Lương</b></p><p><b style="color:#15a85f">+45.000 ₫</b> · Hôm qua</p><p><i>tháng 10</i></p><p><i>Gõ <b>/undo</b> để hủy</i></p>',
    );
  });

  it('formats undone and linked replies', () => {
    expect(undoneReply([tx({ note: 'phở' })])).toBe(
      '<p><b style="color:#f27806">↩ Đã hủy</b>: phở · <s>−45.000 ₫</s></p>',
    );
    expect(undoneReply([tx()])).toBe(
      '<p><b style="color:#f27806">↩ Đã hủy</b>: Ăn sáng · <s>−45.000 ₫</s></p>',
    );
    expect(linkedReply('Thức')).toBe(
      '<p><b style="color:#15a85f">✓ Đã liên kết</b> với Sổ Chi của <b>Thức</b></p><p>Thử nhắn: <b>ăn phở 45k</b></p>',
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
    expect(undoneReply([tx({ note: long })]).length).toBeLessThan(2000);
    expect(linkedReply(long).length).toBeLessThan(2000);
  });

  it('lists several transactions in one confirm reply', () => {
    const html = confirmManyReply(
      [
        tx({ store: 'Nguyễn Văn A' }),
        tx(
          { id: 't2', type: 'in', amount: 500000, date: '2026-10-13' },
          { name: 'Lương', parentName: null },
        ),
      ],
      TODAY,
    );
    expect(html).toBe(
      '<p><b style="color:#15a85f">✓ Đã ghi 2 giao dịch</b></p>' +
        '<p><b style="color:#db342e">−45.000 ₫</b> · <b>Ăn sáng</b> · Nguyễn Văn A · Hôm nay</p>' +
        '<p><b style="color:#15a85f">+500.000 ₫</b> · <b>Lương</b> · Hôm qua</p>' +
        '<p><i>Gõ <b>/undo</b> để hủy</i></p>',
    );
  });

  it('lists several transactions in one undone reply', () => {
    expect(undoneReply([tx({ store: 'A' }), tx({ note: 'phở' })])).toBe(
      '<p><b style="color:#f27806">↩ Đã hủy 2 giao dịch</b></p>' +
        '<p>A · <s>−45.000 ₫</s></p><p>phở · <s>−45.000 ₫</s></p>',
    );
  });

  it('keeps a 20-transaction reply under 2000 chars', () => {
    const long = '&'.repeat(500);
    const txs = Array.from({ length: 20 }, () =>
      tx({ store: long }, { name: long }),
    );
    const confirm = confirmManyReply(txs, TODAY);
    expect(confirm.length).toBeLessThan(2000);
    expect(confirm).toContain('giao dịch khác');
    expect(undoneReply(txs).length).toBeLessThan(2000);
  });
});
