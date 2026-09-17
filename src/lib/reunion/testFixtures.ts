/**
 * 재회운 데이터 계층 테스트 픽스처.
 *
 * 프로덕션 코드가 아니라 테스트 전용이다(`src/**\/*.test.ts` 에서만 import 한다).
 * `SajuReportData` 전체를 손으로 만들면 유지가 안 되므로, 이 계층이 실제로 읽는 필드만 채운다.
 */

import type { SajuReportData } from '../saju/report';
import { REUNION_CONTEXT_VERSION, type ReunionContext } from './types';

export function makeReunionContext(overrides: Partial<ReunionContext> = {}): ReunionContext {
  return {
    schemaVersion: REUNION_CONTEXT_VERSION,
    breakupDuration: 'threeTo6m',
    contactStatus: 'occasional',
    lastContactAt: '2026-08-20',
    breakupReason: '대화 방식이 달라 여러 번 부딪혔어요.',
    desiredOutcome: 'clarity',
    notes: '돌려받을 물건이 하나 있어요.',
    consentToUsePartnerData: true,
    ...overrides
  };
}

function monthCells() {
  /* 12개 구간. score 를 일부러 넓게 퍼뜨려 33/67 분위가 갈리게 만든다. */
  const scores = [8, 4, 6, 9, 3, 5, 7, 2, 6, 8, 4, 5];
  return scores.map((score, index) => {
    const month = ((9 + index - 1) % 12) + 1;
    const year = 2026 + Math.floor((9 + index - 1) / 12);
    return {
      year,
      month,
      ganzhi: '갑자',
      score,
      summary: `${month}월 흐름 요약`,
      focus: `${month}월에 볼 것`,
      warning: `${month}월에 조심할 것`,
      validFrom: new Date(Date.UTC(year, month - 1, 6)).toISOString(),
      validTo: new Date(Date.UTC(year, month, 6)).toISOString()
    };
  });
}

export interface ReunionReportFixtureOptions {
  /** 궁합 근거 섹션을 넣을지. false 면 CH02·CH05 가 축소 렌더 경로로 간다. */
  withCompatibility?: boolean;
  /** `표현과 의사소통` 축의 tendency. */
  expressionTendency?: 'supportive' | 'conditional' | 'tension' | 'insufficient';
  /** `관계 지속과 회복` 축의 tendency. CH05 반복 지점 표가 이 값에서 나온다. */
  continuityTendency?: 'supportive' | 'conditional' | 'tension' | 'insufficient';
  /** 십성 분포. CH01 의 성향 문장이 상위 하나에서 나온다. 빈 배열이면 문장을 만들지 않는다. */
  tenGods?: ReadonlyArray<{ label: string; value: number }>;
}

export function makeReunionSajuReport(options: ReunionReportFixtureOptions = {}): SajuReportData {
  const withCompatibility = options.withCompatibility !== false;
  const expressionTendency = options.expressionTendency || 'conditional';
  const continuityTendency = options.continuityTendency || 'conditional';

  const compatibilitySection = {
    id: 'compatibility-evidence-v2',
    title: '두 사람 정밀 궁합 근거',
    subtitle: '연애 목적별 구조 분석',
    paragraphs: [
      '두 사람의 구조는 조율 방식을 현실에서 확인해야 합니다.',
      '일간 관계는 서로의 속도를 다르게 씁니다.',
      '배우자궁은 접점이 좁게 잡힙니다.',
      '오행 교환은 한쪽으로 기울어 있습니다.'
    ],
    cards: [
      {
        title: '초기 끌림과 반응성',
        body: '처음 반응 속도는 서로 맞는 편입니다.',
        tone: 'good',
        badge: 'supportive · 근거 강함'
      },
      {
        title: '감정 교류의 흐름',
        body: '감정 표현의 속도를 서로 조율할 필요가 있습니다.',
        tone: 'default',
        badge: 'conditional · 근거 보통'
      },
      {
        title: '표현과 의사소통',
        body: '말을 꺼내는 방식이 서로 다르게 잡힙니다.',
        tone: expressionTendency === 'tension' ? 'warn' : 'default',
        badge: `${expressionTendency} · 근거 제한`
      },
      {
        title: '관계 지속과 회복',
        body: '회복에는 조건이 붙습니다.',
        tone: continuityTendency === 'tension' ? 'warn' : 'default',
        badge: `${continuityTendency} · 근거 보통`
      }
    ],
    details: [
      {
        summary: 'day-master · supportive',
        content: '일간 구조에서 서로를 밀어주는 방향이 있습니다.\n\n근거 ID: compatibility:day-master',
        open: true
      },
      {
        summary: 'spouse-palace · mixed',
        content:
          '배우자궁에서 접점과 마찰이 함께 잡힙니다.\n\n근거 ID: compatibility:spouse-palace\n\n유보: 상대의 태어난 시간이 확정되지 않았습니다.',
        open: false
      }
    ],
    callout: { title: '궁합 판정 원칙', body: '정적 궁합이며 현재 흐름은 포함하지 않습니다.' }
  };

  const report = {
    serviceId: 'love-reunion',
    kind: 'reunion',
    title: '재회운 리포트',
    subtitle: '',
    badge: '',
    serialNumber: 'UW-REUNION-0001',
    createdAt: '2026-09-18T01:00:00.000Z',
    birthLabel: '1994년 3월 12일',
    questionPreview: '먼저 안부를 물어도 될까요?',
    customerName: '지윤',
    zodiac: '개',
    dayMaster: '갑',
    dayMasterElement: '목',
    strengthLabel: '신강',
    helpfulElements: ['수', '금'],
    cautiousElements: ['화'],
    gyeokguk: '식신격',
    heroNote: '',
    keyTakeaways: [
      { title: '기록이 남아 있어요', body: '' },
      { title: '일상의 리듬이 남아 있어요', body: '' },
      { title: '말할 사람이 남아 있어요', body: '' }
    ],
    /* `range` 는 나이 문자열이고, 연도 표기는 계산된 경계에서만 나온다.
       생년(1994) + 시작 나이(30)로 되짚으면 2024~2033 이 되지만 실제 구간은 2025~2035 다. */
    currentDayun: {
      name: '乙巳',
      range: '30세 ~ 39세',
      summary: '',
      focus: '',
      caution: '',
      startsAt: '2025-01-20T00:00:00.000Z',
      endsAt: '2035-01-20T00:00:00.000Z'
    },
    nextDayun: { name: '丙午', range: '40세 ~ 49세', summary: '', focus: '', caution: '' },
    legalNotice: [],
    pillars: { year: '갑술', month: '정묘', day: '갑자', hour: '병인' },
    fiveElements: [
      { label: '목', value: 3, color: '#3f8f5f' },
      { label: '화', value: 2, color: '#c0492f' },
      { label: '토', value: 1, color: '#8a7345' },
      { label: '금', value: 1, color: '#9aa0a6' },
      { label: '수', value: 1, color: '#3f6f9f' }
    ],
    tenGods: options.tenGods || [
      { label: '상관', value: 3 },
      { label: '편재', value: 2 },
      { label: '정인', value: 1 }
    ],
    visibleTenGods: [
      {
        pillar: '년주',
        stem: '갑',
        stemHanja: '甲',
        stemTenGod: '비견',
        branch: '술',
        branchHanja: '戌',
        branchMainStem: '정',
        branchTenGod: '상관',
        reading: '甲 비견 / 戌 상관'
      },
      {
        pillar: '월주',
        stem: '정',
        stemHanja: '丁',
        stemTenGod: '상관',
        branch: '묘',
        branchHanja: '卯',
        branchMainStem: '을',
        branchTenGod: '겁재',
        reading: '丁 상관 / 卯 겁재'
      },
      {
        pillar: '일주',
        stem: '갑',
        stemHanja: '甲',
        stemTenGod: '비견',
        branch: '자',
        branchHanja: '子',
        branchMainStem: '계',
        branchTenGod: '정인',
        reading: '甲 비견 / 子 정인'
      },
      {
        pillar: '시주',
        stem: '병',
        stemHanja: '丙',
        stemTenGod: '식신',
        branch: '인',
        branchHanja: '寅',
        branchMainStem: '무',
        branchTenGod: '편재',
        reading: '丙 식신 / 寅 편재'
      }
    ],
    tenGodBasisNote: '천간과 지지의 대표 기운을 분리해 봅니다.',
    metaGrid: [],
    summary: { title: '', analysis: [], advice: [] },
    questionAnswers: [],
    sections: [
      {
        id: 'temporal-evidence-v2',
        title: '시기 근거',
        paragraphs: ['시기 흐름은 사건 확정이 아니라 행동 점검 범위로 사용합니다.']
      },
      ...(withCompatibility ? [compatibilitySection] : [])
    ],
    yearLuck: [2026, 2027, 2028, 2029, 2030].map((year, index) => ({
      year,
      ganzhi: '병오',
      score: [5, 7, 4, 8, 6][index],
      headline: `${year}년`,
      summary: `${year}년 흐름`,
      focus: `${year}년에 볼 것`,
      warning: ''
    })),
    monthLuck: monthCells(),
    actionPlan: { title: '', priorities: [], dos: [], avoids: [], luckyDays: [], unluckyDays: [] },
    qualityAudit: { score: 0, status: 'pass', items: [], warnings: [], repeatedSentences: [], bannedTerms: [], typoSignals: [] },
    engineMeta: {
      evidenceCount: 137,
      calculationPrecision: 'exact-minute',
      releaseDecision: 'eligible',
      uncertainty: []
    }
  };

  return report as unknown as SajuReportData;
}
