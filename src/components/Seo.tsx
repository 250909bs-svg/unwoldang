import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.unwoldang.com').replace(/\/$/, '');

type RouteSeo = {
  title: string;
  description: string;
  keywords: string;
  image?: string;
};

const defaultSeo: RouteSeo = {
  title: '운월당 | 사주·종합사주·신년운세·연애운 프리미엄 리포트',
  description:
    '운월당은 만세력 기반 종합사주, 신년운세, 연애운, 결혼운, 재회운, 궁합, 타로 리포트를 제공하는 프리미엄 운세 서비스입니다.',
  keywords: '운월당, 사주, 종합사주, 신년운세, 연애운, 결혼운, 재회운, 궁합, 타로, 운세, 만세력',
  image: '/intake-night-blue.png'
};

const routeSeo: Record<string, RouteSeo> = {
  '/': defaultSeo,
  '/menu': {
    title: '운월당 전체 리포트 | 종합사주·연애운·궁합·결혼운',
    description:
      '운월당의 종합사주, 신년운세, 연애운, 결혼운, 재회운, 궁합 리포트를 한눈에 비교하고 선택하세요.',
    keywords: '운월당 전체 리포트, 사주 카테고리, 종합사주, 연애운, 궁합, 결혼운, 재회운',
    image: '/intake-beauty-red.png'
  },
  '/tarot': {
    title: '운월당 타로 | 연애운·재회운·결혼운 카드 리딩',
    description: '연애운, 재회운, 결혼운을 신비로운 카드 리딩으로 확인하는 운월당 타로 서비스입니다.',
    keywords: '타로, 연애타로, 재회타로, 결혼타로, 운월당 타로',
    image: '/tarot-lucky-amulet.png'
  },
  '/test': {
    title: '운월당 심리테스트 | 성향·연애·운세 테스트',
    description: '운월당 심리테스트에서 성향, 연애, 운세 흐름을 가볍게 확인해보세요.',
    keywords: '심리테스트, 연애 심리테스트, 성향 테스트, 운세 테스트',
    image: '/test-star-character.png'
  },
  '/test/face-ai': {
    title: 'AI 관상 테스트 | 운월당 심리테스트',
    description: 'AI 관상 테스트로 얼굴 분위기와 성향 키워드를 재미있게 확인하는 운월당 콘텐츠입니다.',
    keywords: 'AI 관상, 관상 테스트, 얼굴상 테스트, 운월당 테스트',
    image: '/test-thinking.png'
  },
  '/detail/general-signature': {
    title: '종합사주 리포트 | 운월당 정밀 사주 분석',
    description:
      '성향, 재물, 직업, 연애와 결혼, 대운과 세운까지 한 번에 정리하는 운월당 대표 종합사주 리포트입니다.',
    keywords: '종합사주, 사주 분석, 만세력 사주, 대운, 세운, 운월당 종합사주',
    image: '/intake-night-blue.png'
  },
  '/detail/life-flow': {
    title: '신년운세 리포트 | 운월당 인생 흐름 분석',
    description: '2026년 신년운세와 앞으로의 인생 흐름, 상승 구간과 조심할 시기를 정리하는 운월당 리포트입니다.',
    keywords: '신년운세, 2026년 운세, 올해 운세, 인생 흐름, 대운 분석',
    image: '/intake-lantern-night.png'
  },
  '/detail/concern-reading': {
    title: '고민풀이 사주 리포트 | 운월당 2,900원 사주 고민 분석',
    description: '사주 구조, 십성, 신살, 대운과 세운으로 지금의 고민을 감정 상태, 인간관계, 돈, 일 스타일, 행동 처방전까지 정리합니다.',
    keywords: '고민풀이, 사주 고민, 신년운세 고민풀이, 십성 분석, 신살 분석, 운월당 고민풀이',
    image: '/intake-lantern-night.png'
  },
  '/detail/love-reading': {
    title: '연애운 리포트 | 운월당 인연·감정 흐름 분석',
    description: '내가 끌리는 사람, 오래 가는 인연, 연애 패턴과 만남의 흐름을 정리하는 운월당 연애운 리포트입니다.',
    keywords: '연애운, 연애 사주, 인연운, 썸, 미래 배우자, 운월당 연애운',
    image: '/intake-blossom-girl.png'
  },
  '/detail/love-reunion': {
    title: '재회운 리포트 | 운월당 재회 가능성 분석',
    description: '남아 있는 감정, 다시 이어질 가능성, 재회 타이밍과 조심할 점을 정리하는 운월당 재회운 리포트입니다.',
    keywords: '재회운, 재회 가능성, 전남친 재회, 전여친 재회, 재회 사주',
    image: '/intake-beauty-red.png'
  },
  '/detail/match-couple': {
    title: '사주궁합 리포트 | 운월당 궁합 분석',
    description: '두 사람의 감정 리듬, 생활 궁합, 결혼 가능성과 관계 흐름을 함께 읽는 운월당 사주궁합 리포트입니다.',
    keywords: '사주궁합, 궁합, 커플 궁합, 결혼 궁합, 운월당 궁합',
    image: '/intake-beauty-red.png'
  },
  '/detail/marriage-blueprint': {
    title: '결혼운 리포트 | 운월당 결혼 흐름 분석',
    description: '결혼 시기, 배우자 성향, 현실적인 생활 궁합과 결혼 안정감을 정리하는 운월당 결혼운 리포트입니다.',
    keywords: '결혼운, 결혼 사주, 배우자운, 결혼 시기, 운월당 결혼운',
    image: '/intake-sunlight-girl.png'
  },
  '/detail/marriage-timing': {
    title: '혼인 시기 리포트 | 운월당 결혼 타이밍 분석',
    description: '결혼을 서두를 때와 기다릴 때를 구분해주는 운월당 혼인 시기 리포트입니다.',
    keywords: '혼인 시기, 결혼 타이밍, 결혼운, 배우자운, 운월당',
    image: '/intake-lantern-night.png'
  },
  '/terms': {
    title: '이용약관 | 운월당',
    description: '운월당 서비스 이용약관입니다.',
    keywords: '운월당 이용약관'
  },
  '/privacy': {
    title: '개인정보처리방침 | 운월당',
    description: '운월당 개인정보처리방침입니다.',
    keywords: '운월당 개인정보처리방침'
  },
  '/refund': {
    title: '환불정책 | 운월당',
    description: '운월당 유료 콘텐츠 결제 취소 및 환불정책입니다.',
    keywords: '운월당 환불정책'
  },
  '/admin': {
    title: '운월당 관리자',
    description: '운월당 운영자 전용 관리자 페이지입니다.',
    keywords: '운월당 관리자'
  }
};

Object.assign(routeSeo, {
  '/form/general-signature': routeSeo['/detail/general-signature'],
  '/form/life-flow': routeSeo['/detail/life-flow'],
  '/form/concern-reading': routeSeo['/detail/concern-reading'],
  '/form/love-reading': routeSeo['/detail/love-reading'],
  '/form/love-reunion': routeSeo['/detail/love-reunion'],
  '/form/match-couple': routeSeo['/detail/match-couple'],
  '/form/marriage-blueprint': routeSeo['/detail/marriage-blueprint'],
  '/form/marriage-timing': routeSeo['/detail/marriage-timing']
});

const noIndexPrefixes = ['/form/', '/report/', '/auth/', '/payment/'];
const noIndexPaths = new Set(['/checkout', '/loading', '/login', '/my', '/admin']);

function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }

  link.href = url;
}

function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

export default function Seo() {
  const location = useLocation();

  useEffect(() => {
    const path = normalizePath(location.pathname);
    const seo = routeSeo[path] ?? defaultSeo;
    const shouldNoIndex = noIndexPaths.has(path) || noIndexPrefixes.some((prefix) => path.startsWith(prefix));
    const canonicalUrl = `${SITE_URL}${path === '/' ? '/' : path}`;
    const imageUrl = `${SITE_URL}${seo.image ?? defaultSeo.image}`;

    document.title = seo.title;
    setMeta('description', seo.description);
    setMeta('keywords', seo.keywords);
    setMeta(
      'robots',
      shouldNoIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    );
    setCanonical(canonicalUrl);

    setMeta('og:locale', 'ko_KR', 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:site_name', '운월당', 'property');
    setMeta('og:title', seo.title, 'property');
    setMeta('og:description', seo.description, 'property');
    setMeta('og:url', canonicalUrl, 'property');
    setMeta('og:image', imageUrl, 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', seo.title);
    setMeta('twitter:description', seo.description);
    setMeta('twitter:image', imageUrl);
  }, [location.pathname]);

  return null;
}
