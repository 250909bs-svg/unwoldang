import type { ProductModuleDefinition } from '../types';

export const lifeFlowProduct = {
  id: 'life-flow',
  displayName: '운월선생 신년운세',
  price: 59_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/life-flow',
    intake: '/form/life-flow',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/life-flow'
  },
  discovery: {
    title: '운월선생 신년운세',
    summary: '다가오는 12개월의 기회와 조심할 시기',
    category: 'general',
    featured: false
  },
  search: {
    title: '운월선생 신년운세',
    image: '/intake-lantern-night.png',
    keywords: ['신년운세', '올해', '2026', '월별운세', '운세', '시기']
  },
  home: {
    title: '운월선생 신년운세',
    subtitle: '다가오는 12개월의 기회와 조심할 시기',
    image: '/home-yearly-fortune-card.png',
    category: 'all-only'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
