'use client';

import { AlertDialog, Button, Chip, Dropdown } from '@heroui/react';
import { Ellipsis } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import type { ActionResult } from '@/lib/action-result';
import type { UserListItem } from '@/server/services/users';

import { useToast } from '@/components/ui/toast';
import { UserAvatar } from '@/features/shell/user-avatar';

import {
  blockUserAction,
  deleteUserAction,
  setUserRoleAction,
  unblockUserAction,
} from './actions';

type Confirming = 'block' | 'delete';

export function UserCard({
  user,
  isSelf,
}: {
  user: UserListItem;
  isSelf: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  // `kind` outlives `open` so the dialog text doesn't change during its exit animation.
  const [kind, setKind] = useState<Confirming>('block');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const isAdmin = user.role === 'admin';
  const isBlocked = user.blockedAt !== null;

  const run = async (
    action: () => Promise<ActionResult<unknown>>,
    successKey: 'roleChanged' | 'blocked' | 'unblocked' | 'deleted',
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    let res;
    try {
      res = await action();
    } catch {
      toast.show({ title: t('errors.unknown') });
      return;
    } finally {
      inFlight.current = false;
      setBusy(false);
      setOpen(false);
    }
    if (!res.ok) {
      toast.show({ title: t(`errors.${res.error}`) });
      return;
    }
    toast.show({ title: t(`admin.users.${successKey}`) });
  };

  const toggleRole = () =>
    run(
      () =>
        setUserRoleAction({ id: user.id, role: isAdmin ? 'user' : 'admin' }),
      'roleChanged',
    );
  const unblock = () =>
    run(() => unblockUserAction({ id: user.id }), 'unblocked');
  const ask = (next: Confirming) => {
    setKind(next);
    setOpen(true);
  };
  const confirm = () => {
    if (!open) return;
    if (kind === 'block')
      return run(() => blockUserAction({ id: user.id }), 'blocked');
    return run(() => deleteUserAction({ id: user.id }), 'deleted');
  };

  const onAction = (key: React.Key) => {
    if (key === 'role') void toggleRole();
    else if (key === 'block') {
      if (isBlocked) void unblock();
      else ask('block');
    } else if (key === 'delete') ask('delete');
  };

  return (
    <div className="bg-card border-subtle rounded-card flex flex-col gap-3 border p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <div className="type-body-sm text-strong truncate font-medium">
            {user.name}
          </div>
          <div className="type-caption text-subtle truncate">{user.email}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              variant="soft"
              color={isAdmin ? 'accent' : 'default'}
            >
              {isAdmin ? t('admin.users.roleAdmin') : t('admin.users.roleUser')}
            </Chip>
            <Chip
              size="sm"
              variant="soft"
              color={isBlocked ? 'danger' : 'success'}
            >
              {isBlocked
                ? t('admin.users.statusBlocked')
                : t('admin.users.statusActive')}
            </Chip>
            {isSelf ? (
              <Chip size="sm" variant="soft">
                {t('admin.users.you')}
              </Chip>
            ) : null}
            <span className="type-caption text-muted">
              {t('admin.users.joined', {
                date: format.dateTime(user.createdAt, {
                  dateStyle: 'medium',
                  timeZone: 'Asia/Ho_Chi_Minh',
                }),
              })}
            </span>
          </div>
        </div>
        {isSelf ? null : (
          <Dropdown>
            <Button
              isIconOnly
              variant="tertiary"
              size="sm"
              isDisabled={busy}
              aria-label={t('admin.users.actions')}
            >
              <Ellipsis size={18} strokeWidth={1.75} />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={onAction}>
                <Dropdown.Item
                  id="role"
                  textValue={
                    isAdmin
                      ? t('admin.users.removeAdmin')
                      : t('admin.users.makeAdmin')
                  }
                >
                  {isAdmin
                    ? t('admin.users.removeAdmin')
                    : t('admin.users.makeAdmin')}
                </Dropdown.Item>
                <Dropdown.Item
                  id="block"
                  textValue={
                    isBlocked
                      ? t('admin.users.unblock')
                      : t('admin.users.block')
                  }
                >
                  {isBlocked
                    ? t('admin.users.unblock')
                    : t('admin.users.block')}
                </Dropdown.Item>
                <Dropdown.Item
                  id="delete"
                  variant="danger"
                  textValue={t('admin.users.delete')}
                >
                  {t('admin.users.delete')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </div>

      <AlertDialog
        isOpen={open}
        onOpenChange={(next) => {
          if (!next && !inFlight.current) setOpen(false);
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {kind === 'block'
                    ? t('admin.users.blockTitle', { name: user.name })
                    : t('admin.users.deleteTitle', { name: user.name })}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  {kind === 'block'
                    ? t('admin.users.blockBody')
                    : t('admin.users.deleteBody', { name: user.name })}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  {t('categories.cancel')}
                </Button>
                <Button
                  variant="danger"
                  isDisabled={busy}
                  onPress={() => void confirm()}
                >
                  {kind === 'block'
                    ? t('admin.users.block')
                    : t('admin.users.delete')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
