import type { ProductModuleDefinition } from '../types';

export const loveReunionProduct = {
  id: 'love-reunion',
  displayName: '운월당 재회운',
  price: 990,
  currency: 'KRW',
  routes: {
    detail: '/detail/love-reunion',
    intake: '/form/love-reunion',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/love-reunion',
    preview: '/preview/love-reunion'
  },
  discovery: {
    title: '운월당 재회운',
    summary: '다시 이어지기 위한 조건과 연락 판단 기준',
    category: 'love',
    featured: true,
    recommendationRank: 4
  },
  search: {
    title: '운월당 재회운',
    image: '/assets/reunion/hero-640.webp',
    keywords: ['재회', '전남친', '전여친', '이별', '연락', '미련', '다시']
  },
  home: {
    title: '운월당 재회운',
    subtitle: '다시 이어지기 위한 조건과 연락 판단 기준',
    image: '/assets/reunion/hero-640.webp',
    category: 'reunion'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: true
  }
} as const satisfies ProductModuleDefinition;
