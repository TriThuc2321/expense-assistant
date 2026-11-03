'use client';

import { AlertDialog, Button, Chip, Tag, TagGroup } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import type { CategoryNode } from '@/server/services/categories';

import { CategoryTile } from '@/components/ui/category-tile';
import { useToast } from '@/components/ui/toast';

import { deleteSubcategoryAction } from './actions';

type Child = CategoryNode['children'][number];

export function CategoryCard({ category }: { category: CategoryNode }) {
  const t = useTranslations();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Child | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);

  const remove = async (child: Child) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    let res;
    try {
      res = await deleteSubcategoryAction({ id: child.id });
    } catch {
      toast.show({ title: t('errors.unknown') });
      return;
    } finally {
      inFlight.current = false;
      setDeleting(false);
      setConfirming(null);
    }
    if (!res.ok) {
      toast.show({ title: t(`errors.${res.error}`) });
      return;
    }
    toast.show({ title: t('categories.deleted') });
  };

  const onRemove = (keys: Set<unknown>) => {
    const child = category.children.find((c) => keys.has(c.id));
    if (!child) return;
    if (child.txCount === 0) void remove(child);
    else setConfirming(child);
  };

  return (
    <div className="bg-card border-subtle rounded-card flex flex-col gap-3 border p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <CategoryTile icon={category.icon} color={category.color} />
        <span className="type-body-sm text-strong flex-1 font-medium">
          {category.name}
        </span>
        <Chip
          size="sm"
          variant="soft"
          color={category.type === 'out' ? 'accent' : 'success'}
        >
          {category.type === 'out'
            ? t('categories.expense')
            : t('categories.income')}
        </Chip>
      </div>
      {category.children.length > 0 ? (
        <TagGroup
          aria-label={t('categories.subcategories')}
          onRemove={onRemove}
        >
          <TagGroup.List items={category.children}>
            {(child) => (
              <Tag id={child.id} textValue={child.name}>
                {child.name}
              </Tag>
            )}
          </TagGroup.List>
        </TagGroup>
      ) : null}

      <AlertDialog
        isOpen={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !inFlight.current) setConfirming(null);
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {t('categories.removeTitle', {
                    name: confirming?.name ?? '',
                  })}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  {t('categories.removeBody', {
                    count: confirming?.txCount ?? 0,
                    parent: category.name,
                  })}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  {t('categories.cancel')}
                </Button>
                <Button
                  variant="danger"
                  isDisabled={deleting}
                  onPress={() => confirming && void remove(confirming)}
                >
                  {t('categories.confirm')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
