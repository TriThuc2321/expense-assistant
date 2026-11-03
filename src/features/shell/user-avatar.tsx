import { Avatar } from '@heroui/react';

import type { AppSession } from '@/server/auth/session';

type UserAvatarProps = {
  user: Pick<AppSession['user'], 'name' | 'image'>;
  size?: 'sm' | 'md' | 'lg';
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export function UserAvatar({ user, size = 'sm' }: UserAvatarProps) {
  return (
    <Avatar size={size}>
      {user.image ? <Avatar.Image alt={user.name} src={user.image} /> : null}
      <Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
    </Avatar>
  );
}
