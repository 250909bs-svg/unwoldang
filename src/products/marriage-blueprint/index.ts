import type { ProductModuleDefinition } from '../types';

export const marriageBlueprintProduct = {
  id: 'marriage-blueprint',
  displayName: '청연부인 결혼운 설계도',
  price: 72_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/marriage-blueprint',
    intake: '/form/marriage-blueprint',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/marriage-blueprint'
  },
  discovery: {
    title: '청연부인 결혼운 설계도',
    summary: '배우자 흐름과 현실적인 혼인 기준',
    category: 'marriage',
    featured: false
  },
  search: {
    title: '청연부인 결혼운 설계도',
    image: '/intake-sunlight-girl.png',
    keywords: ['결혼', '결혼운', '배우자', '혼인', '시기', '가정']
  },
  home: {
    title: '청연부인 결혼운 설계도',
    subtitle: '배우자 흐름과 현실적인 혼인 기준',
    image: '/intake-blossom-girl.png',
    category: 'marriage'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
