import type { ProductModuleDefinition } from '../types';

export const matchDestinyProduct = {
  id: 'match-destiny',
  displayName: '월연도령 운명 궁합',
  price: 63_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/match-destiny',
    intake: '/form/match-destiny',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/match-destiny'
  },
  discovery: {
    title: '월연도령 운명 궁합',
    summary: '오래 이어질 인연인지 보는 깊은 궁합',
    category: 'compatibility',
    featured: false
  },
  search: {
    title: '월연도령 운명 궁합',
    image: '/intake-beauty-red.png',
    keywords: ['운명궁합', '인연', '궁합', '커플', '장기연애', '배우자']
  },
  home: {
    title: '월연도령 운명 궁합',
    subtitle: '오래 이어질 인연인지 보는 깊은 궁합',
    image: '/intake-beauty-red.png',
    category: 'match'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'compatibility',
    requiresPartnerBirth: true
  }
} as const satisfies ProductModuleDefinition;
