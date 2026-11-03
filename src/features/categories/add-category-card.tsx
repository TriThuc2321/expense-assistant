'use client';

import { Button, Input, Tag, TagGroup, TextField } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';

import type { CategoryNode } from '@/server/services/categories';

import { useToast } from '@/components/ui/toast';

import { createCategoryAction } from './actions';

const ROOT_KEY = '__root__';

export function AddCategoryCard({ roots }: { roots: CategoryNode[] }) {
  const t = useTranslations();
  const toast = useToast();
  const [parentKey, setParentKey] = useState<string>(ROOT_KEY);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const parent = roots.find((r) => r.id === parentKey) ?? null;
  const trimmed = name.trim();

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    // State updates lag behind a fast second Enter, so guard with a ref.
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    let res;
    try {
      res = await createCategoryAction({
        name: trimmed,
        parentId: parent?.id ?? null,
      });
    } catch {
      toast.show({ title: t('errors.unknown') });
      return;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
    if (!res.ok) {
      toast.show({ title: t(`errors.${res.error}`) });
      return;
    }
    setName('');
    toast.show({ title: t('categories.added') });
  };

  return (
    <form
      onSubmit={submit}
      className="bg-card border-subtle rounded-card flex flex-col gap-3 border p-4 shadow-sm"
    >
      <span className="type-label text-strong">{t('categories.title')}</span>
      <TagGroup
        aria-label={t('categories.parentLabel')}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([parentKey])}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (typeof next === 'string') setParentKey(next);
        }}
      >
        <TagGroup.List>
          <Tag id={ROOT_KEY}>{t('categories.rootTag')}</Tag>
          {roots.map((root) => (
            <Tag key={root.id} id={root.id} textValue={root.name}>
              {root.name}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>
      <div className="flex gap-2">
        <TextField
          fullWidth
          aria-label={t('categories.nameLabel')}
          value={name}
          onChange={setName}
          className="min-w-0 flex-1"
        >
          <Input
            maxLength={40}
            placeholder={
              parent
                ? t('categories.childPlaceholder', { parent: parent.name })
                : t('categories.rootPlaceholder')
            }
          />
        </TextField>
        <Button type="submit" isDisabled={!trimmed || saving}>
          {t('categories.add')}
        </Button>
      </div>
    </form>
  );
}
