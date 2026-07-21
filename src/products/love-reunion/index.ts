import type { ProductModuleDefinition } from '../types';

export const loveReunionProduct = {
  id: 'love-reunion',
  displayName: '홍연아씨 재회 가능성',
  price: 55_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/love-reunion',
    intake: '/form/love-reunion',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/love-reunion'
  },
  discovery: {
    title: '홍연아씨 재회 가능성',
    summary: '재접촉 조건과 회복 방향',
    category: 'love',
    featured: true,
    recommendationRank: 4
  },
  search: {
    title: '홍연아씨 재회 가능성',
    image: '/intake-beauty-red.png',
    keywords: ['재회', '전남친', '전여친', '이별', '연락', '미련', '다시']
  },
  home: {
    title: '홍연아씨 재회운',
    subtitle: '재접촉 조건과 회복 방향',
    image: '/home-love-reunion-card.png',
    category: 'reunion'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
