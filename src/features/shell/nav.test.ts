import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, TAB_ITEMS, isTabActive } from './nav';

describe('isTabActive', () => {
  it('treats categories as part of settings', () => {
    expect(isTabActive('/settings', '/categories')).toBe(true);
    expect(isTabActive('/settings', '/categories/abc')).toBe(true);
  });
  it('matches analyze and keeps home exact', () => {
    expect(isTabActive('/analyze', '/analyze')).toBe(true);
    expect(isTabActive('/', '/analyze')).toBe(false);
  });
});

describe('nav items', () => {
  it('puts analytics in the tab bar instead of categories', () => {
    expect(TAB_ITEMS.map((i) => i.href)).toEqual([
      '/',
      '/transactions',
      '/analyze',
      '/settings',
    ]);
  });
  it('keeps every page in the sidebar', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      '/',
      '/transactions',
      '/analyze',
      '/categories',
      '/settings',
    ]);
  });
});
