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
    report: '/report/love-reunion',
    preview: '/preview/love-reunion'
  },
  discovery: {
    title: 'MZ큐피트 재회운',
    summary: '두 사람의 명리 구조와 실제 이별·연락 행동을 분리해 읽는 재회 전략',
    category: 'love',
    featured: true,
    recommendationRank: 4
  },
  search: {
    title: 'MZ큐피트 재회운',
    image: '/intake-beauty-red.png',
    keywords: ['재회', '전남친', '전여친', '이별', '연락', '미련', '다시']
  },
  home: {
    title: 'MZ큐피트 재회운',
    subtitle: '명리 구조와 이별·연락 행동을 함께 읽는 재회 전략',
    image: '/home-love-reunion-card.png',
    category: 'reunion'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
