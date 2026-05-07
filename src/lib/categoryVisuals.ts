import {
  Gem,
  Grid2x2,
  Heart,
  ScrollText,
  UsersRound,
  type LucideIcon
} from 'lucide-react';
import type { ServiceCategoryId } from '../api/mockData';

export type CategoryVisual = {
  icon: LucideIcon;
  tint: string;
  accent: string;
  note: string;
};

export const categoryVisuals: Record<ServiceCategoryId, CategoryVisual> = {
  all: {
    icon: Grid2x2,
    tint: '#f5efe6',
    accent: '#745f45',
    note: '전체 리포트'
  },
  general: {
    icon: ScrollText,
    tint: '#efe6d4',
    accent: '#8d6536',
    note: '인생 흐름'
  },
  love: {
    icon: Heart,
    tint: '#fce8ed',
    accent: '#d8607f',
    note: '썸·재회'
  },
  compatibility: {
    icon: UsersRound,
    tint: '#eef0ff',
    accent: '#6d74d7',
    note: '두 사람 궁합'
  },
  marriage: {
    icon: Gem,
    tint: '#f6eee3',
    accent: '#b68a54',
    note: '배우자 흐름'
  }
};

export const homeShortcutCategories: ServiceCategoryId[] = [
  'general',
  'love',
  'compatibility',
  'marriage'
];

export const highlightChips = [
  '종합사주',
  '연애운',
  '궁합',
  '결혼운',
  '카카오 로그인',
  '토스 결제 준비'
] as const;
