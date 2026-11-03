import type { Locale } from '@/i18n';

import type { TxType } from './types';

export type CategoryColor =
  | 'food'
  | 'home'
  | 'move'
  | 'shop'
  | 'fun'
  | 'health'
  | 'income';

export type DefaultCategory = {
  slug: string;
  name: Record<Locale, string>;
  icon: string;
  color: CategoryColor;
  type: TxType;
  children: { slug: string; name: Record<Locale, string> }[];
};

const n = (vi: string, en: string): Record<Locale, string> => ({ vi, en });

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    slug: 'food',
    name: n('Ăn uống', 'Food & drink'),
    icon: 'utensils',
    color: 'food',
    type: 'out',
    children: [
      { slug: 'food.breakfast', name: n('Ăn sáng', 'Breakfast') },
      { slug: 'food.lunch', name: n('Ăn trưa', 'Lunch') },
      { slug: 'food.dinner', name: n('Ăn tối', 'Dinner') },
      { slug: 'food.coffee', name: n('Cà phê', 'Coffee') },
    ],
  },
  {
    slug: 'home',
    name: n('Nhà ở', 'Housing'),
    icon: 'house',
    color: 'home',
    type: 'out',
    children: [
      { slug: 'home.rent', name: n('Tiền nhà', 'Rent') },
      { slug: 'home.electric', name: n('Điện', 'Electricity') },
      { slug: 'home.water', name: n('Nước', 'Water') },
      { slug: 'home.internet', name: n('Internet', 'Internet') },
    ],
  },
  {
    slug: 'move',
    name: n('Di chuyển', 'Transport'),
    icon: 'bike',
    color: 'move',
    type: 'out',
    children: [
      { slug: 'move.grab', name: n('Grab', 'Grab') },
      { slug: 'move.fuel', name: n('Xăng', 'Fuel') },
      { slug: 'move.parking', name: n('Gửi xe', 'Parking') },
    ],
  },
  {
    slug: 'shop',
    name: n('Mua sắm', 'Shopping'),
    icon: 'shopping-bag',
    color: 'shop',
    type: 'out',
    children: [
      { slug: 'shop.grocery', name: n('Đi chợ', 'Groceries') },
      { slug: 'shop.clothes', name: n('Quần áo', 'Clothes') },
      { slug: 'shop.goods', name: n('Đồ dùng', 'Household') },
    ],
  },
  {
    slug: 'fun',
    name: n('Giải trí', 'Entertainment'),
    icon: 'clapperboard',
    color: 'fun',
    type: 'out',
    children: [
      { slug: 'fun.netflix', name: n('Netflix', 'Netflix') },
      { slug: 'fun.spotify', name: n('Spotify', 'Spotify') },
      { slug: 'fun.movie', name: n('Xem phim', 'Movies') },
    ],
  },
  {
    slug: 'health',
    name: n('Sức khỏe', 'Health'),
    icon: 'heart-pulse',
    color: 'health',
    type: 'out',
    children: [
      { slug: 'health.medicine', name: n('Thuốc', 'Medicine') },
      { slug: 'health.gym', name: n('Gym', 'Gym') },
    ],
  },
  {
    slug: 'income',
    name: n('Thu nhập', 'Income'),
    icon: 'wallet',
    color: 'income',
    type: 'in',
    children: [
      { slug: 'income.salary', name: n('Lương', 'Salary') },
      { slug: 'income.bonus', name: n('Thưởng', 'Bonus') },
      { slug: 'income.other', name: n('Khác', 'Other') },
    ],
  },
];
