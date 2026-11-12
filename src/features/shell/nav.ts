import type { LucideIcon } from 'lucide-react';

import { ChartPie, LayoutDashboard, List, Settings, Tags } from 'lucide-react';

export type NavHref =
  | '/'
  | '/transactions'
  | '/analyze'
  | '/categories'
  | '/settings';

export type NavItem = {
  href: NavHref;
  labelKey: 'home' | 'transactions' | 'analyze' | 'categories' | 'settings';
  icon: LucideIcon;
};

const HOME: NavItem = { href: '/', labelKey: 'home', icon: LayoutDashboard };
const TRANSACTIONS: NavItem = {
  href: '/transactions',
  labelKey: 'transactions',
  icon: List,
};
const ANALYZE: NavItem = {
  href: '/analyze',
  labelKey: 'analyze',
  icon: ChartPie,
};
const CATEGORIES: NavItem = {
  href: '/categories',
  labelKey: 'categories',
  icon: Tags,
};
const SETTINGS: NavItem = {
  href: '/settings',
  labelKey: 'settings',
  icon: Settings,
};

export const NAV_ITEMS: NavItem[] = [
  HOME,
  TRANSACTIONS,
  ANALYZE,
  CATEGORIES,
  SETTINGS,
];

export const TAB_ITEMS: NavItem[] = [HOME, TRANSACTIONS, ANALYZE, SETTINGS];

export function isNavActive(href: NavHref, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The tab bar has no Categories tab; it's reached from Settings there.
export function isTabActive(href: NavHref, pathname: string): boolean {
  if (href === '/settings' && isNavActive('/categories', pathname)) return true;
  return isNavActive(href, pathname);
}
