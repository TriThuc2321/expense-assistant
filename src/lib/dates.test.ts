import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  monthRange,
  monthStart,
  sameRangeLastMonth,
  todayVn,
} from './dates';

describe('dates', () => {
  it('todayVn uses Asia/Ho_Chi_Minh', () => {
    expect(todayVn(new Date('2026-10-13T17:30:00Z'))).toBe('2026-10-14');
    expect(todayVn(new Date('2026-10-13T16:30:00Z'))).toBe('2026-10-13');
  });
  it('addDays crosses boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('monthStart and addMonths', () => {
    expect(monthStart('2026-10-14')).toBe('2026-10-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(addMonths('2026-11-01', 2)).toBe('2027-01-01');
  });
  it('monthRange', () => {
    expect(monthRange('2026-02-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(monthRange('2028-02-10').to).toBe('2028-02-29');
  });
  it('sameRangeLastMonth clamps to last day of previous month', () => {
    expect(sameRangeLastMonth('2026-10-14')).toEqual({
      from: '2026-09-01',
      to: '2026-09-14',
    });
    expect(sameRangeLastMonth('2026-10-31')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(sameRangeLastMonth('2026-03-31')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
});
