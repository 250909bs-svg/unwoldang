import type { ProductModuleDefinition } from '../types';

export const generalSignatureProduct = {
  id: 'general-signature',
  displayName: '운월선생 정통 종합사주',
  price: 79_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/general-saju',
    intake: '/form/general-signature',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/general-signature'
  },
  discovery: {
    title: '운월선생 정통 종합사주',
    summary: '타고난 기질부터 인생 전체 흐름까지',
    category: 'general',
    featured: true,
    recommendationRank: 1
  },
  search: {
    title: '운월선생 정통 종합사주',
    image: '/intake-night-blue.png',
    keywords: ['종합사주', '사주', '대운', '세운', '인생', '원국', '오행', '십성']
  },
  home: {
    title: '운월선생 정통 종합사주',
    subtitle: '타고난 기질부터 인생 전체 흐름까지',
    image: '/home-general-saju-card.webp',
    category: 'general'
  },
  flow: {
    detailVariant: 'general-signature',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
