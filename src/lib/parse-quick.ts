import { LOCALE } from '@/constants/locale';

import type { TxType } from './types';

import { DEFAULT_CATEGORIES } from './categories-default';
import { addDays } from './dates';

export type QuickParse = {
  type: TxType;
  amount: number;
  categorySlug: string;
  store: string | null;
  note: string;
  date: string;
  confidence: 'high' | 'low';
};

const KW: readonly (readonly [RegExp, string])[] = [
  [/phở|bún|bánh mì|xôi|ăn sáng/, 'food.breakfast'],
  [/cơm|ăn trưa|bữa trưa/, 'food.lunch'],
  [/lẩu|nướng|nhậu|ăn tối/, 'food.dinner'],
  [
    /cà phê|cafe|cà fê|coffee|trà sữa|highlands|phúc long|starbucks/,
    'food.coffee',
  ],
  [/ăn uống|ăn /, 'food'],
  [/grab|taxi|xe ôm/, 'move.grab'],
  [/xăng/, 'move.fuel'],
  [/gửi xe/, 'move.parking'],
  [/di chuyển|đi lại/, 'move'],
  [/chợ|siêu thị|bách hóa|rau/, 'shop.grocery'],
  [/quần|giày|uniqlo|áo thun|áo khoác/, 'shop.clothes'],
  [/shopee|lazada|tiki/, 'shop.goods'],
  [/mua sắm/, 'shop'],
  [/netflix/, 'fun.netflix'],
  [/spotify/, 'fun.spotify'],
  [/phim|cgv/, 'fun.movie'],
  [/giải trí/, 'fun'],
  [/thuốc/, 'health.medicine'],
  [/gym/, 'health.gym'],
  [/sức khỏe/, 'health'],
  [/tiền nhà|thuê nhà/, 'home.rent'],
  [/tiền nước/, 'home.water'],
  [/tiền điện|điện/, 'home.electric'],
  [/internet|wifi/, 'home.internet'],
  [/nhà ở/, 'home'],
  [/lương/, 'income.salary'],
  [/thưởng/, 'income.bonus'],
];

const STORES: readonly (readonly [string, string])[] = [
  ['highlands', 'Highlands Coffee'],
  ['phúc long', 'Phúc Long'],
  ['starbucks', 'Starbucks'],
  ['grab', 'Grab'],
  ['shopee', 'Shopee'],
  ['cgv', 'CGV'],
  ['bách hóa', 'Bách Hóa Xanh'],
  ['uniqlo', 'Uniqlo'],
  ['circle k', 'Circle K'],
  ['phở thìn', 'Phở Thìn'],
];

const FALLBACK_SLUG = 'shop.goods';
const INCOME_OTHER_SLUG = 'income.other';

const upperFirst = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const titleCase = (s: string) =>
  s.split(/\s+/).filter(Boolean).map(upperFirst).join(' ');

function childName(slug: string): string {
  for (const root of DEFAULT_CATEGORIES) {
    const child = root.children.find((c) => c.slug === slug);
    if (child) return child.name[LOCALE.VI];
  }
  return '';
}

function resolveSlug(slug: string): string {
  const root = DEFAULT_CATEGORIES.find((c) => c.slug === slug);
  return root ? root.children[0].slug : slug;
}

export function parseQuick(text: string, today: string): QuickParse | null {
  const s = text.normalize('NFC').trim();
  const low = s.toLowerCase();
  const m = low.match(
    /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(nghìn|ngàn|triệu|tr|củ|k)?/,
  );
  if (!m) return null;

  const token = /^\d{1,3}(\.\d{3})+$/.test(m[1])
    ? m[1].replace(/\./g, '')
    : m[1].replace(',', '.');
  let n = parseFloat(token);
  const u = m[2] ?? '';
  if (/nghìn|ngàn|k/.test(u)) n *= 1000;
  else if (/triệu|tr|củ/.test(u)) n *= 1e6;
  else if (n < 1000) n *= 1000;
  if (!n) return null;

  let rest = (s.slice(0, m.index) + ' ' + s.slice((m.index ?? 0) + m[0].length))
    .replace(/\s+/g, ' ')
    .trim();

  let date = today;
  if (/hôm qua/i.test(rest)) {
    date = addDays(today, -1);
    rest = rest
      .replace(/hôm qua/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  let store: string | null = null;
  const sm = rest.match(/\s(?:ở|tại)\s(.+)$/i);
  if (sm) {
    store = titleCase(sm[1]);
    rest = rest.slice(0, sm.index).trim();
  }
  if (!store) {
    const k = STORES.find((x) => low.includes(x[0]));
    if (k) store = k[1];
  }

  const kwHit = KW.find((k) => k[0].test(low + ' '));
  let slug = kwHit ? kwHit[1] : FALLBACK_SLUG;
  const confidence: QuickParse['confidence'] = kwHit ? 'high' : 'low';
  slug = resolveSlug(slug);

  let type: TxType = slug.startsWith('income.') ? 'in' : 'out';
  if (/nhận|được cho|hoàn tiền/.test(low)) {
    type = 'in';
    if (!slug.startsWith('income.')) slug = INCOME_OTHER_SLUG;
  }

  return {
    type,
    amount: Math.round(n),
    categorySlug: slug,
    store,
    note: upperFirst(rest) || childName(slug),
    date,
    confidence,
  };
}

export function isQuestion(text: string): boolean {
  const l = text.normalize('NFC').toLowerCase();
  return (
    /\?|bao nhiêu|mấy|tổng|so sánh|so với|nhiều nhất|thế nào|ra sao|đã tiêu|tiêu hết|chi hết/.test(
      l,
    ) || !/\d/.test(l)
  );
}
