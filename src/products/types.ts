export const productIds = [
  'general-signature',
  'life-flow',
  'concern-reading',
  'past-life-goblin',
  'love-reading',
  'love-reunion',
  'match-couple',
  'match-destiny',
  'marriage-blueprint',
  'marriage-timing',
  'career-reading',
  'money-reading'
] as const;

export type ProductId = (typeof productIds)[number];

export const productStatuses = ['active', 'draft', 'archived'] as const;
export type ProductStatus = (typeof productStatuses)[number];

export type ProductCategory = 'general' | 'love' | 'compatibility' | 'marriage' | 'career' | 'wealth';
export type ProductHomeCategory =
  | 'general'
  | 'love'
  | 'reunion'
  | 'marriage'
  | 'match'
  | 'wealth'
  | 'all-only';

export type ProductDetailVariant = 'standard' | 'general-signature' | 'past-life' | 'love-reading';
export type ProductIntakeVariant = 'standard' | 'past-life' | 'love-reading' | 'compatibility';

export interface ProductRoutes {
  detail: string;
  intake: string;
  checkout: '/checkout';
  loading: '/loading';
  report: string;
  preview?: string;
  supplemental?: readonly string[];
}

export interface ProductDiscoveryMetadata {
  title: string;
  summary: string;
  category: ProductCategory;
  featured: boolean;
  recommendationRank?: number;
}

export interface ProductSearchMetadata {
  title: string;
  image: string;
  keywords: readonly string[];
}

export interface ProductHomeMetadata {
  title: string;
  subtitle: string;
  image: string;
  category: ProductHomeCategory;
  video?: string;
  artworkTitle?: boolean;
  fullPoster?: boolean;
  imagePosition?: string;
}

export interface ProductFlowAdapters {
  detailVariant: ProductDetailVariant;
  intakeVariant: ProductIntakeVariant;
  requiresPartnerBirth: boolean;
}

export interface ProductModuleDefinition {
  id: ProductId;
  displayName: string;
  price: number;
  currency: 'KRW';
  routes: ProductRoutes;
  discovery: ProductDiscoveryMetadata;
  search: ProductSearchMetadata;
  home: ProductHomeMetadata;
  flow: ProductFlowAdapters;
}

export interface ProductDefinition extends ProductModuleDefinition {
  status: ProductStatus;
}
