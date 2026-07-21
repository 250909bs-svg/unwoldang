import baseSeoRouteData from './seoRoutes.json';
import { GENERAL_SIGNATURE_SEO, GENERAL_SIGNATURE_SEO_PATH } from '../products/general-signature';

export type RouteSeo = {
  title: string;
  description: string;
  keywords: string;
  image: string;
  imageAlt?: string;
  heading: string;
  intro: string;
  highlights: string[];
  serviceId?: string;
  productName?: string;
  price?: number;
  priceCurrency?: string;
  sections?: Array<{ heading: string; body: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  indexable: boolean;
  lastmod: string;
};

export const seoRouteData: Record<string, RouteSeo> = {
  ...(baseSeoRouteData as Record<string, RouteSeo>),
  [GENERAL_SIGNATURE_SEO_PATH]: GENERAL_SIGNATURE_SEO
};
