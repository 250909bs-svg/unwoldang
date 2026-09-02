import type { GoldenSourceTier } from './schema';

export interface GoldenSourceManifestEntry {
  sourceId: string;
  name: string;
  authority: string;
  tier: GoldenSourceTier;
  reference: string;
  version: string;
  accessedAt: string;
  fieldsSupported: string[];
  policyNotes: string[];
  limitations: string[];
  licenseNotes: string;
}

export const goldenSourceManifest: GoldenSourceManifestEntry[] = [
  {
    sourceId: 'kasi-lunar-api-v1.1',
    name: '한국천문연구원 음양력 정보 API',
    authority: '한국천문연구원 / 공공데이터포털',
    tier: 'A',
    reference: 'https://www.data.go.kr/data/15012679/openapi.do',
    version: '1.1',
    accessedAt: '2026-08-25',
    fieldsSupported: ['normalizedSolarDate', 'normalizedLunarDate', 'leapMonth', 'yearPillar', 'monthPillar', 'dayPillar'],
    policyNotes: ['KASI가 실제 응답으로 제공한 필드만 근거로 사용한다.'],
    limitations: ['시주·십성·12운성·대운은 지원하지 않는다.'],
    licenseNotes: '공공데이터포털 이용조건을 따르며 인증키와 원문 전체 응답은 저장하지 않는다.'
  },
  {
    sourceId: 'kasi-specialday-api-v1.4',
    name: '한국천문연구원 특일 정보 API',
    authority: '한국천문연구원 / 공공데이터포털',
    tier: 'A',
    reference: 'https://www.data.go.kr/data/15012690/openapi.do',
    version: '1.4',
    accessedAt: '2026-08-25',
    fieldsSupported: ['solarTermDate'],
    policyNotes: ['24절기 날짜 확인에만 사용한다.'],
    limitations: ['분 단위 절입 시각과 사주 월주를 직접 제공하지 않는다.'],
    licenseNotes: '공공데이터포털 이용조건을 따른다.'
  },
  {
    sourceId: 'hko-gregorian-lunar-calendar',
    name: 'Hong Kong Observatory Gregorian-Lunar Calendar',
    authority: 'Hong Kong Observatory',
    tier: 'A',
    reference: 'https://www.hko.gov.hk/en/gts/time/conversion.htm',
    version: 'annual PDF tables, 1901-2100',
    accessedAt: '2026-09-02',
    fieldsSupported: ['normalizedSolarDate', 'normalizedLunarDate', 'leapMonth'],
    policyNotes: ['PDF별 SHA-256을 evidence에 보존한다.'],
    limitations: ['표의 간지년은 설 기준이므로 입춘 기준 사주 연주 근거로 사용하지 않는다.'],
    licenseNotes: '검증에 필요한 최소 날짜·해시만 보존한다.'
  },
  {
    sourceId: 'naoj-reki-yoko-2024',
    name: 'NAOJ 2024 solar-term instants',
    authority: 'National Astronomical Observatory of Japan',
    tier: 'A',
    reference: 'https://eco.mtk.nao.ac.jp/koyomi/yoko/2024/rekiyou242.html.en',
    version: '2024 annual table',
    accessedAt: '2026-09-02',
    fieldsSupported: ['solarTermBoundaryInstant', 'boundaryRelativeMinutes'],
    policyNotes: ['JST와 KST가 모두 UTC+09:00인 점을 명시적으로 적용한다.'],
    limitations: ['절기 시각만 제공하며 사주 연주·월주를 제공하지 않는다.'],
    licenseNotes: '표 전체가 아닌 사용한 절기 시각과 출처만 보존한다.'
  },
  {
    sourceId: 'iana-tzdb-2026b',
    name: 'IANA Time Zone Database',
    authority: 'Internet Assigned Numbers Authority',
    tier: 'A',
    reference: 'https://www.iana.org/time-zones',
    version: '2026b / ICU 78.3',
    accessedAt: '2026-09-02',
    fieldsSupported: ['utcOffsetMinutes', 'normalizedInstant'],
    policyNotes: ['명시한 IANA zone과 출생 당시 offset을 함께 고정한다.'],
    limitations: ['진태양시와 균시차를 검증하지 않는다.'],
    licenseNotes: 'IANA tzdb 라이선스를 따른다.'
  },
  {
    sourceId: 'chen-twelve-stages-2021',
    name: 'Twelve Life Stages and hidden-stem table',
    authority: 'C. Chen, Chinese Medicine, 2021',
    tier: 'C',
    reference: 'https://doi.org/10.4236/cm.2021.123007',
    version: '2021, tables A1/A2 and hidden-stem table',
    accessedAt: '2026-09-02',
    fieldsSupported: ['twelveStages', 'hiddenStems'],
    policyNotes: ['10천간×12지지 전표와 지장간 순서를 별도 비교한다.'],
    limitations: ['명리 학파별 표기·순서 차이가 있을 수 있어 Tier C로 제한한다.'],
    licenseNotes: '표를 검증 코드로 전사하고 문헌 전체는 저장하지 않는다.'
  },
  {
    sourceId: 'bazichic-reference-2017',
    name: 'BaZi reference tables',
    authority: 'BaZiChic',
    tier: 'C',
    reference: 'https://www.bazichic.com/uploads/documents/bazichik20191229010749.pdf',
    version: 'September 2017, pages 71-72',
    accessedAt: '2026-09-02',
    fieldsSupported: ['tenGods', 'stemRelations', 'branchRelations'],
    policyNotes: ['표준 매핑과 정책 민감 해석을 분리한다.'],
    limitations: ['공식 천문기관 자료가 아니며 형·원진 등 학파 차이가 있다.'],
    licenseNotes: '검증에 필요한 매핑만 사용한다.'
  }
];

export const independentProviderCandidates = [
  {
    name: 'DateDB',
    reference: 'https://datedb.net/tool/saju-worksheet/19920909/',
    decision: 'pending' as const,
    reason: '재현 가능한 공개 출력은 있으나 알고리즘 버전·야자시·대운 정책·라이선스가 충분히 문서화되지 않았다.'
  },
  {
    name: 'Mansaenyang',
    reference: 'https://www.mansaenyang.com/saju/1992-09-09',
    decision: 'pending' as const,
    reason: '출력 확인은 가능하지만 계산 버전·시간대·절입·대운 정책이 독립 검증 요건을 충족하지 못했다.'
  },
  {
    name: '8s8s calendar',
    reference: 'https://calendar.8s8s.net/ganzhichaxun.php?d=9&m=9&y=1992',
    decision: 'rejected' as const,
    reason: '버전·정책·재현 계약·사용 조건을 확인할 수 없어 Golden expected authority로 승인하지 않았다.'
  }
];
