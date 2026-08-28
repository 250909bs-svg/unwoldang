import type { ProductModuleDefinition } from '../types';

export const matchCoupleProduct = {
  id: 'match-couple',
  displayName: '월연도령 사주궁합',
  price: 69_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/match-couple',
    intake: '/form/match-couple',
    checkout: '/checkout',
    loading: '/loading',
    preview: '/preview/match-couple',
    report: '/report/match-couple'
  },
  discovery: {
    title: '월연도령 사주궁합',
    summary: '두 사람의 속도와 생활 궁합 분석',
    category: 'compatibility',
    featured: true,
    recommendationRank: 5
  },
  search: {
    title: '월연도령 사주궁합',
    image: '/home-match-couple-card.png',
    keywords: ['궁합', '커플', '상대', '결혼궁합', '속궁합', '연인', '배우자']
  },
  home: {
    title: '월연도령 사주궁합',
    subtitle: '두 사람의 속도와 생활 궁합 분석',
    image: '/home-match-couple-card.png',
    category: 'match'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'compatibility',
    requiresPartnerBirth: true
  }
} as const satisfies ProductModuleDefinition;
