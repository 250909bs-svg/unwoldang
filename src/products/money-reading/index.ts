import type { ProductModuleDefinition } from '../types';

export const moneyReadingProduct = {
  id: 'money-reading',
  displayName: '운월선생 금전운 설계도',
  price: 59_000,
  currency: 'KRW',
  routes: {
    detail: '/detail/money-reading',
    intake: '/form/money-reading',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/money-reading'
  },
  discovery: {
    title: '운월선생 금전운 설계도',
    summary: '돈이 들어오고 머무는 나만의 흐름',
    category: 'wealth',
    featured: false
  },
  search: {
    title: '운월선생 금전운 설계도',
    image: '/intake-lantern-night.png',
    keywords: ['재물', '돈', '금전', '사업', '투자', '수익', '매출']
  },
  home: {
    title: '운월선생 재물운 설계도',
    subtitle: '돈이 들어오고 머무는 나만의 흐름',
    image: '/intake-sunlight-girl.png',
    category: 'wealth'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} as const satisfies ProductModuleDefinition;
