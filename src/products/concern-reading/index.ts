import type { ProductModuleDefinition } from '../types';

export const concernReadingProduct = {
  id: 'concern-reading',
  displayName: '운월당 고민풀이',
  price: 2_900,
  currency: 'KRW',
  routes: {
    detail: '/detail/concern-reading',
    intake: '/form/concern-reading',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/concern-reading'
  },
  discovery: {
    title: '운월당 고민풀이',
    summary: '지금 가장 답답한 고민을 사주로 정리',
    category: 'general',
    featured: false
  },
  search: {
    title: '운월당 고민풀이',
    image: '/intake-sunlight-girl.png',
    keywords: ['고민', '고민풀이', '질문', '상담', '선택', '이사', '퇴사', '연애질문', '진로']
  },
  home: {
    title: '운월당 고민풀이',
    subtitle: '지금 가장 답답한 고민을 사주로 정리',
    image: '/home-concern-reading-card.png',
    category: 'all-only'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
