import type { ProductModuleDefinition } from '../types';

export const careerReadingProduct = {
  id: 'career-reading',
  displayName: '운월선생 직업운 설계도',
  price: 59_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/career-reading',
    intake: '/form/career-reading',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/career-reading'
  },
  discovery: {
    title: '운월선생 직업운 설계도',
    summary: '직업 방향과 나에게 맞는 일의 방식',
    category: 'career',
    featured: false
  },
  search: {
    title: '운월선생 직업운 설계도',
    image: '/intake-night-blue.png',
    keywords: ['직업', '진로', '이직', '퇴사', '창업', '커리어', '일']
  },
  home: {
    title: '운월선생 직업운 설계도',
    subtitle: '직업 방향과 나에게 맞는 일의 방식',
    image: '/intake-night-blue.png',
    category: 'all-only'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
