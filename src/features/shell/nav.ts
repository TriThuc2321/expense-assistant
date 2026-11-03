import type { LucideIcon } from 'lucide-react';

import { LayoutDashboard, List, Settings, Tags } from 'lucide-react';

export type NavHref = '/' | '/transactions' | '/categories' | '/settings';

export type NavItem = {
  href: NavHref;
  labelKey: 'home' | 'transactions' | 'categories' | 'settings';
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'home', icon: LayoutDashboard },
  { href: '/transactions', labelKey: 'transactions', icon: List },
  { href: '/categories', labelKey: 'categories', icon: Tags },
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

export function isNavActive(href: NavHref, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
