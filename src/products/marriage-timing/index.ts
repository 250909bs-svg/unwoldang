import type { ProductModuleDefinition } from '../types';

export const marriageTimingProduct = {
  id: 'marriage-timing',
  displayName: '청연부인 혼인 시기 리포트',
  price: 58_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/marriage-timing',
    intake: '/form/marriage-timing',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/marriage-timing'
  },
  discovery: {
    title: '청연부인 혼인 시기 리포트',
    summary: '결혼이 안정되는 시기와 선택 포인트',
    category: 'marriage',
    featured: false
  },
  search: {
    title: '청연부인 혼인 시기 리포트',
    image: '/intake-lantern-night.png',
    keywords: ['결혼', '혼인', '결혼시기', '혼인적기', '배우자', '결혼운']
  },
  home: {
    title: '청연부인 혼인 적기',
    subtitle: '결혼이 안정되는 시기와 선택 포인트',
    image: '/intake-lantern-night.png',
    category: 'marriage'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
