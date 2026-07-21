import type { ProductModuleDefinition } from '../types';
import {
  GENERAL_SIGNATURE_DETAIL_PATH,
  GENERAL_SIGNATURE_DISPLAY_NAME,
  GENERAL_SIGNATURE_FORM_PATH,
  GENERAL_SIGNATURE_ID,
  GENERAL_SIGNATURE_REPORT_PATH
} from './product';

export const generalSignatureProduct = {
  id: GENERAL_SIGNATURE_ID,
  displayName: GENERAL_SIGNATURE_DISPLAY_NAME,
  price: 79_000,
  currency: 'KRW',
  routes: {
    detail: GENERAL_SIGNATURE_DETAIL_PATH,
    intake: GENERAL_SIGNATURE_FORM_PATH,
    checkout: '/checkout',
    loading: '/loading',
    report: GENERAL_SIGNATURE_REPORT_PATH
  },
  discovery: {
    title: GENERAL_SIGNATURE_DISPLAY_NAME,
    summary: '타고난 기질부터 인생 전체 흐름까지',
    category: 'general',
    featured: true,
    recommendationRank: 1
  },
  search: {
    title: GENERAL_SIGNATURE_DISPLAY_NAME,
    image: '/intake-night-blue.png',
    keywords: ['종합사주', '사주', '대운', '세운', '인생', '원국', '오행', '십성']
  },
  home: {
    title: GENERAL_SIGNATURE_DISPLAY_NAME,
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

export * from './intake';
export * from './product';
export * from './presentation';
export * from './seo';
export * from './share';
