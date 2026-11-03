'use client';

import { Button } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function ThemeSwitch() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      isIconOnly
      className="rounded-full"
      onPress={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun size={18} strokeWidth={1.75} data-hide-on-theme="dark" />
      <Moon size={18} strokeWidth={1.75} data-hide-on-theme="light" />
    </Button>
  );
}
