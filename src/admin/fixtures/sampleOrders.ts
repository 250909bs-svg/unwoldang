import { productRegistry, type ProductId } from '../../products';
import type { AdminOrder, CustomerProfile, DeviceType, SourceChannel } from '../types/admin';

export const sampleChannels: SourceChannel[] = ['카카오', '네이버검색', '인스타그램', '직접방문', '재방문'];

export const sampleDevices: DeviceType[] = ['mobile', 'mobile', 'mobile', 'desktop'];

export const sampleAges = ['20대 후반', '30대 초반', '30대 후반', '40대 초반', '비공개'];

export type SampleOrderSeed = {
  productId: ProductId;
  name: string;
  offsetHours: number;
  status?: AdminOrder['status'];
  reportStatus?: AdminOrder['reportStatus'];
  readRate: number;
  issueCount?: number;
  channel: SourceChannel;
  device: DeviceType;
  ageRange: string;
  reportLatencySec: number;
};

export const sampleSeeds: SampleOrderSeed[] = [
  { productId: 'concern-reading', name: '차민호', offsetHours: 1440.35, readRate: 96, channel: '카카오', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 19 },
  { productId: 'general-signature', name: '김서연', offsetHours: 1.1, readRate: 91, channel: '네이버검색', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 42 },
  { productId: 'love-reading', name: '이하준', offsetHours: 2.2, readRate: 78, issueCount: 1, channel: '인스타그램', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 36 },
  { productId: 'life-flow', name: '박지아', offsetHours: 1460, readRate: 83, channel: '직접방문', device: 'desktop', ageRange: '40대 초반', reportLatencySec: 28 },
  { productId: 'marriage-blueprint', name: '정도윤', offsetHours: 1500, readRate: 94, channel: '재방문', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 31 },
  { productId: 'match-couple', name: '한유진', offsetHours: 5.6, readRate: 87, channel: '카카오', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 24 },
  { productId: 'past-life-goblin', name: '오민재', offsetHours: 7.5, status: 'pending', reportStatus: 'generating', readRate: 38, channel: '네이버검색', device: 'mobile', ageRange: '비공개', reportLatencySec: 68 },
  { productId: 'love-reunion', name: '윤하린', offsetHours: 9.2, readRate: 82, channel: '인스타그램', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 33 },
  { productId: 'concern-reading', name: '서지후', offsetHours: 1600, readRate: 93, channel: '카카오', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 21 },
  { productId: 'general-signature', name: '강나은', offsetHours: 29.1, readRate: 89, channel: '재방문', device: 'desktop', ageRange: '40대 초반', reportLatencySec: 47 },
  { productId: 'marriage-timing', name: '문도현', offsetHours: 1650, readRate: 72, channel: '네이버검색', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 39 },
  { productId: 'match-destiny', name: '배수아', offsetHours: 1700, readRate: 86, channel: '직접방문', device: 'desktop', ageRange: '30대 초반', reportLatencySec: 34 },
  { productId: 'concern-reading', name: '차민호', offsetHours: 1750, readRate: 98, channel: '재방문', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 18 },
  { productId: 'love-reading', name: '김서연', offsetHours: 66.4, readRate: 76, channel: '인스타그램', device: 'mobile', ageRange: '30대 후반', reportLatencySec: 41 },
  { productId: 'life-flow', name: '이하준', offsetHours: 1800, status: 'failed', reportStatus: 'failed', readRate: 0, issueCount: 1, channel: '네이버검색', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 120 },
  { productId: 'concern-reading', name: '박지아', offsetHours: 1850, readRate: 90, channel: '카카오', device: 'mobile', ageRange: '40대 초반', reportLatencySec: 20 },
  { productId: 'general-signature', name: '정도윤', offsetHours: 111.5, readRate: 92, channel: '직접방문', device: 'desktop', ageRange: '30대 후반', reportLatencySec: 46 },
  { productId: 'love-reunion', name: '한유진', offsetHours: 130.2, readRate: 81, channel: '인스타그램', device: 'mobile', ageRange: '30대 초반', reportLatencySec: 35 },
  { productId: 'concern-reading', name: '오민재', offsetHours: 1900, readRate: 84, channel: '카카오', device: 'mobile', ageRange: '비공개', reportLatencySec: 22 },
  { productId: 'match-couple', name: '윤하린', offsetHours: 166.7, readRate: 88, channel: '재방문', device: 'mobile', ageRange: '20대 후반', reportLatencySec: 37 }
];

export function buildSampleOrders(referenceTime = Date.now()): AdminOrder[] {
  return sampleSeeds.map((seed, index) => {
    const product = productRegistry[seed.productId];
    const createdAt = new Date(referenceTime - seed.offsetHours * 1000 * 60 * 60).toISOString();

    return {
      id: `sample-${seed.productId}-${index}`,
      orderId: `UW-SAMPLE-${String(index + 1).padStart(4, '0')}`,
      productId: seed.productId,
      productName: product.displayName,
      productStatus: product.status,
      category: product.discovery.category,
      customerName: seed.name,
      customerEmail: `${seed.name.toLowerCase()}@kakao.sample`,
      amount: product.price,
      status: seed.status || 'paid',
      reportStatus: seed.reportStatus || 'done',
      paymentMethod: index % 3 === 0 ? 'kakaoPay' : 'portone',
      createdAt,
      readRate: seed.readRate,
      issueCount: seed.issueCount || 0,
      source: 'sample',
      sourceChannel: seed.channel,
      device: seed.device,
      ageRange: seed.ageRange,
      reportLatencySec: seed.reportLatencySec,
      analyticsEstimated: true
    };
  });
}

export function buildSampleSignupProfiles(referenceTime = Date.now()): CustomerProfile[] {
  return [
    {
      id: 'signup-only-1',
      name: '최라온',
      maskedName: '최*온',
      email: 'ra***@kakao.sample',
      orders: 0,
      paidOrders: 0,
      spent: 0,
      lastProduct: '가입 후 상품 탐색',
      lastSeen: new Date(referenceTime - 1000 * 60 * 24).toISOString(),
      readRate: 0,
      analyticsAvailable: true,
      provider: 'kakao',
      signedAt: new Date(referenceTime - 1000 * 60 * 31).toISOString(),
      status: 'registered',
      sourceChannel: '카카오',
      device: 'mobile',
      segment: '가입만 완료',
      riskScore: 71,
      nextAction: '첫 결제 유도용 판매 중 상품 안내와 제공 항목 노출'
    },
    {
      id: 'signup-only-2',
      name: '신아린',
      maskedName: '신*린',
      email: 'ar***@kakao.sample',
      orders: 0,
      paidOrders: 0,
      spent: 0,
      lastProduct: '결제창 전 이탈',
      lastSeen: new Date(referenceTime - 1000 * 60 * 76).toISOString(),
      readRate: 0,
      analyticsAvailable: true,
      provider: 'kakao',
      signedAt: new Date(referenceTime - 1000 * 60 * 102).toISOString(),
      status: 'registered',
      sourceChannel: '인스타그램',
      device: 'mobile',
      segment: '가입만 완료',
      riskScore: 84,
      nextAction: '결제 직전 이탈 고객으로 가격 안내와 제공 항목을 다시 노출'
    }
  ];
}
