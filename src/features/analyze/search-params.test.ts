import { describe, expect, it } from 'vitest';

import { analyzeHref, parseAnalyzeParams } from './search-params';

const today = '2026-11-11';

describe('parseAnalyzeParams', () => {
  it('defaults to the current month', () => {
    expect(parseAnalyzeParams({}, today)).toEqual({
      view: 'month',
      type: 'out',
      p: '2026-11',
      isCurrent: true,
      range: { from: '2026-11-01', to: '2026-11-11' },
      prev: { from: '2026-10-01', to: '2026-10-11' },
      axis: { from: '2026-11-01', to: '2026-11-30' },
      prevP: '2026-10',
      nextP: null,
    });
  });

  it('uses whole months for a past month', () => {
    const p = parseAnalyzeParams({ p: '2026-08' }, today);
    expect(p.range).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(p.prev).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(p.nextP).toBe('2026-09');
    expect(p.isCurrent).toBe(false);
  });

  it('compares the current year to the same range last year', () => {
    const p = parseAnalyzeParams({ view: 'year' }, today);
    expect(p.p).toBe('2026');
    expect(p.range).toEqual({ from: '2026-01-01', to: '2026-11-11' });
    expect(p.prev).toEqual({ from: '2025-01-01', to: '2025-11-11' });
    expect(p.axis).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('uses whole years for a past year', () => {
    const p = parseAnalyzeParams({ view: 'year', p: '2024' }, today);
    expect(p.range).toEqual({ from: '2024-01-01', to: '2024-12-31' });
    expect(p.prev).toEqual({ from: '2023-01-01', to: '2023-12-31' });
    expect(p.nextP).toBe('2025');
  });

  it('converts a p that does not match the view', () => {
    expect(parseAnalyzeParams({ view: 'year', p: '2026-08' }, today).p).toBe(
      '2026',
    );
    expect(parseAnalyzeParams({ p: '2025' }, today).p).toBe('2025-01');
    expect(parseAnalyzeParams({ p: '2026' }, today).p).toBe('2026-11');
  });

  it.each(['2099-01', 'abc', '2026-13', '2015-12', '2026-12'])(
    'falls back to the current month for %s',
    (p) => {
      expect(parseAnalyzeParams({ p }, today).p).toBe('2026-11');
    },
  );

  it('keeps the 10-year floor and stops going back there', () => {
    const p = parseAnalyzeParams({ p: '2016-01' }, today);
    expect(p.p).toBe('2016-01');
    expect(p.prevP).toBeNull();
  });

  it('validates view and type', () => {
    expect(parseAnalyzeParams({ type: 'in' }, today).type).toBe('in');
    expect(parseAnalyzeParams({ type: 'x' }, today).type).toBe('out');
    expect(parseAnalyzeParams({ view: 'week' }, today).view).toBe('month');
    expect(parseAnalyzeParams({ p: ['2026-08', '2026-07'] }, today).p).toBe(
      '2026-08',
    );
  });
});

describe('analyzeHref', () => {
  it('leaves out default view and type', () => {
    expect(analyzeHref({ view: 'month', p: '2026-08', type: 'out' })).toBe(
      '/analyze?p=2026-08',
    );
    expect(analyzeHref({ view: 'year', p: '2025', type: 'in' })).toBe(
      '/analyze?view=year&p=2025&type=in',
    );
  });
});
