'use client';

import { Button } from '@heroui/react';
import { useTheme } from 'next-themes';
import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';

export default function ThemeSwitch() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="tertiary"
      isIconOnly
      className="rounded-full"
      onPress={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <IoSunnyOutline size={12} data-hide-on-theme="dark" />
      <IoMoonOutline size={12} data-hide-on-theme="light" />
    </Button>
  );
}
