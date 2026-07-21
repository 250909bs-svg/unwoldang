import type { ProductModuleDefinition } from '../types';

export const loveReadingProduct = {
  id: 'love-reading',
  displayName: 'MZ무당 팩폭 연애운',
  price: 49_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/love-reading',
    intake: '/form/love-reading',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/love-reading',
    preview: '/preview/love-reading'
  },
  discovery: {
    title: 'MZ무당 팩폭 연애운',
    summary: '반복 패턴부터 다음 인연의 조건까지',
    category: 'love',
    featured: true,
    recommendationRank: 3
  },
  search: {
    title: 'MZ무당 팩폭 연애운',
    image: '/home-love-reading-card.png',
    keywords: ['연애', '썸', '인연', '소개팅', '연락', '고백', '애정', '팩폭', 'MZ무당', '연애사주']
  },
  home: {
    title: 'MZ무당 팩폭 연애운',
    subtitle: '반복 패턴부터 다음 인연의 조건까지',
    image: '/home-love-reading-card.png',
    category: 'love',
    artworkTitle: true,
    fullPoster: true
  },
  flow: {
    detailVariant: 'love-reading',
    intakeVariant: 'love-reading',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
