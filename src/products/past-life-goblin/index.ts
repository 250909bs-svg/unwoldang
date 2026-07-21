import type { ProductModuleDefinition } from '../types';

export const pastLifeGoblinProduct = {
  id: 'past-life-goblin',
  displayName: 'MZ 도깨비 전생사주',
  price: 49_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/past-life-goblin',
    intake: '/form/past-life-goblin',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/past-life-goblin',
    supplemental: ['/detail/past-life-goblin/immersion', '/detail/past-life-goblin/about']
  },
  discovery: {
    title: 'MZ 도깨비 전생사주',
    summary: '전생 캐릭터와 현생에서 풀어야 할 미션',
    category: 'general',
    featured: true,
    recommendationRank: 2
  },
  search: {
    title: 'MZ 도깨비 전생사주',
    image: '/media/dokkaebi-poster.webp',
    keywords: ['전생', '전생사주', '도깨비', 'MZ', '업보', '인연', '반복패턴', '현생미션']
  },
  home: {
    title: 'MZ 도깨비 전생사주',
    subtitle: '전생 캐릭터와 현생에서 풀어야 할 미션',
    image: '/media/dokkaebi-poster.webp',
    category: 'general',
    artworkTitle: true
  },
  flow: {
    detailVariant: 'past-life',
    intakeVariant: 'past-life',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
