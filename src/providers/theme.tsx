'use client';

import { ThemeProvider } from 'next-themes';

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

type ThemeProvidersProps = {
  children: React.ReactNode;
};

export function ThemeProviders({ children }: ThemeProvidersProps) {
  return (
    <ThemeProvider
      attribute="data-theme"
      themes={[ThemeMode.DARK, ThemeMode.LIGHT, ThemeMode.SYSTEM]}
      defaultTheme={ThemeMode.LIGHT}
      enableSystem
    >
      {children}
    </ThemeProvider>
  );
}
