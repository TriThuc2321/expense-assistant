import type { TxView } from '@/server/services/transactions';

import { LOCALE } from '@/constants/locale';
import { dateLabel, formatSignedVnd } from '@/lib/format';

const FIELD_MAX = 120;

// Zalo strips colors outside its palette; these are the hex codes its text_styles API documents.
const COLOR = {
  green: '#15a85f',
  yellow: '#f7b503',
  orange: '#f27806',
  red: '#db342e',
} as const;

function color(c: keyof typeof COLOR, html: string): string {
  return `<b style="color:${COLOR[c]}">${html}</b>`;
}

const HINT = (cmd: string) => `<p><i>Gõ <b>${cmd}</b> để hủy</i></p>`;

export const REPLY = {
  noAmount: `<p>${color('orange', '⚠ Mình chưa hiểu số tiền.')}</p><p>Thử: <b>ăn phở 45k</b></p>`,
  noTotal: `<p>${color('orange', '⚠ Mình không đọc được tổng tiền')}, bạn gõ tay giúp nhé</p>`,
  imageError: `<p>${color('orange', '⚠ Ảnh lỗi')}, gửi lại giúp mình nhé</p>`,
  error: `<p>${color('red', '✕ Có lỗi')}, thử lại sau nhé</p>`,
  nothingToUndo: `<p>${color('yellow', 'Không có giao dịch nào để hoàn tác')}</p>`,
  invalidCode: `<p>${color('red', '✕ Mã không đúng hoặc đã hết hạn')}</p><p>Tạo mã mới trong Cài đặt nhé</p>`,
  linkInGroup: `<p>${color('orange', 'Nhắn riêng cho mình để liên kết nhé')}</p>`,
  notLinked: `<p>${color('orange', 'Nhắn riêng cho mình để liên kết tài khoản trước nhé')}</p><p>Vào Sổ Chi › Cài đặt › Liên kết Zalo để lấy mã, rồi gửi: <b>/link MÃ</b></p>`,
  qaSoon: `<p><i>Hỏi đáp sắp có</i></p>`,
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function field(s: string): string {
  return escapeHtml(s.slice(0, FIELD_MAX));
}

export function confirmReply(
  tx: TxView,
  today: string,
  opts?: { note?: string | null },
): string {
  const { parentName, name } = tx.category;
  const category = parentName
    ? `${field(parentName)} › ${field(name)}`
    : field(name);
  const amount = color(
    tx.type === 'in' ? 'green' : 'red',
    formatSignedVnd(tx.amount, tx.type),
  );
  let html = `<p>${color('green', '✓')} <b>${category}</b></p>`;
  html += `<p>${amount} · ${dateLabel(tx.date, today, LOCALE.VI)}</p>`;
  if (opts?.note) html += `<p><i>${field(opts.note)}</i></p>`;
  return html + HINT('/undo');
}

export function undoneReply(tx: TxView): string {
  const label = field(tx.note ?? tx.category.name);
  return `<p>${color('orange', '↩ Đã hủy')}: ${label} · <s>${formatSignedVnd(tx.amount, tx.type)}</s></p>`;
}

export function linkedReply(userName: string): string {
  return `<p>${color('green', '✓ Đã liên kết')} với Sổ Chi của <b>${field(userName)}</b></p><p>Thử nhắn: <b>ăn phở 45k</b></p>`;
}
