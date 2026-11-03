import type { TxView } from '@/server/services/transactions';

import { LOCALE } from '@/constants/locale';
import { dateLabel, formatSignedVnd } from '@/lib/format';

const FIELD_MAX = 120;

export const REPLY = {
  noAmount: '<p>Mình chưa hiểu số tiền. Thử: <b>ăn phở 45k</b></p>',
  noTotal: '<p>Mình không đọc được tổng tiền, bạn gõ tay giúp nhé</p>',
  imageError: '<p>Ảnh lỗi, gửi lại giúp mình nhé</p>',
  error: '<p>Có lỗi, thử lại sau nhé</p>',
  nothingToUndo: '<p>Không có giao dịch nào để hoàn tác</p>',
  invalidCode:
    '<p>Mã không đúng hoặc đã hết hạn, tạo mã mới trong Cài đặt nhé</p>',
  linkInGroup: '<p>Nhắn riêng cho mình để liên kết nhé</p>',
  notLinked:
    '<p>Nhắn riêng cho mình để liên kết tài khoản trước nhé</p><p>Vào Sổ Chi › Cài đặt › Liên kết Zalo để lấy mã, rồi gửi: <b>/link MÃ</b></p>',
  qaSoon: '<p>Hỏi đáp sắp có</p>',
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
  const amount = formatSignedVnd(tx.amount, tx.type);
  let html = `<p>✓ ${category} · <b>${amount}</b> · ${dateLabel(tx.date, today, LOCALE.VI)}</p>`;
  if (opts?.note) html += `<p><i>${field(opts.note)}</i></p>`;
  return `${html}<p>Gõ <b>/undo</b> để hủy</p>`;
}

export function undoneReply(tx: TxView): string {
  const label = field(tx.note ?? tx.category.name);
  return `<p>↩ Đã hủy: ${label} · <b>${formatSignedVnd(tx.amount, tx.type)}</b></p>`;
}

export function linkedReply(userName: string): string {
  return `<p>✓ Đã liên kết với Sổ Chi của <b>${field(userName)}</b>.</p><p>Thử nhắn: <b>ăn phở 45k</b></p>`;
}
