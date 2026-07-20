import { describe, expect, it } from 'vitest';
import type { EarthlyBranch } from '../saju/constants';
import type { SajuReportData } from '../saju/report';
import { buildPartnerAppearanceProfile } from './partnerAppearance';

const BRANCHES: EarthlyBranch[] = [
  '자',
  '축',
  '인',
  '묘',
  '진',
  '사',
  '오',
  '미',
  '신',
  '유',
  '술',
  '해'
];

function makeReport(overrides: Partial<SajuReportData> = {}): SajuReportData {
  return {
    serialNumber: 'UW-ORIGINAL-001',
    createdAt: '2026-07-20T00:00:00.000Z',
    customerName: '서윤',
    questionPreview: '다음 인연의 외모가 궁금해요.',
    questionAnswers: [
      {
        question: '다음 인연은 어떤 분위기인가요?',
        title: '인연의 분위기',
        analysis: '사주 근거를 기반으로 상징적인 인상을 살펴봅니다.',
        advice: ['외모보다 반복되는 행동과 약속을 함께 확인하세요.']
      }
    ],
    dayMaster: '갑목',
    dayMasterElement: '목',
    pillars: {
      year: '경오',
      month: '을유',
      day: '갑자',
      hour: '정묘'
    },
    helpfulElements: ['화', '수'],
    tenGods: [
      { label: '정관', value: 32 },
      { label: '식신', value: 24 },
      { label: '편인', value: 18 },
      { label: '비견', value: 10 }
    ],
    currentDayun: {
      name: '병인',
      range: '2024~2033',
      summary: '현재 대운',
      focus: '관계의 기준',
      caution: '서두른 확정'
    },
    ...overrides
  } as unknown as SajuReportData;
}

function customerVisibleAppearanceCopy(report: SajuReportData) {
  const profile = buildPartnerAppearanceProfile(report);
  return [
    profile.headline,
    profile.height,
    profile.build,
    profile.faceShape,
    profile.eyes,
    profile.brows,
    profile.nose,
    profile.lips,
    profile.complexion,
    profile.hair,
    profile.style,
    profile.primaryArchetype.label,
    profile.secondaryArchetype.label,
    ...profile.traits,
    profile.disclosure
  ].join('\n');
}

describe('partner appearance deterministic profile', () => {
  it('동일한 원국은 호출 횟수와 관계없이 완전히 같은 프로필을 만든다', () => {
    const report = makeReport();

    const first = buildPartnerAppearanceProfile(report);
    const second = buildPartnerAppearanceProfile(report);

    expect(second).toEqual(first);
    expect(first.version).toBe('partner-appearance-v1');
    expect(first.signatureKey).toMatch(/^pa1-[a-z0-9]{7,}$/u);
  });

  it('이름·질문·리포트 번호·생성 시각·현재 대운은 선천적 외모 프로필을 바꾸지 않는다', () => {
    const original = makeReport();
    const changedMetadata = makeReport({
      serialNumber: 'UW-CHANGED-999',
      createdAt: '2049-12-31T23:59:59.999Z',
      customerName: '완전히다른이름',
      questionPreview: '재회 가능성만 궁금해요.',
      questionAnswers: [
        {
          question: '그 사람이 연락할까요?',
          title: '다른 질문',
          analysis: '외모 산출과 무관한 질문 내용입니다.',
          advice: ['상대의 실제 행동을 확인하세요.']
        }
      ],
      currentDayun: {
        name: '계해',
        range: '2044~2053',
        summary: '완전히 다른 대운',
        focus: '다른 주제',
        caution: '다른 주의점'
      }
    });

    expect(buildPartnerAppearanceProfile(changedMetadata)).toEqual(
      buildPartnerAppearanceProfile(original)
    );
  });
});

describe('partner appearance spouse-palace coverage', () => {
  it('12지지를 soft·sleek·strong·deep 네 imageFamily로 세 개씩 고르게 나눈다', () => {
    const profiles = BRANCHES.map((branch) =>
      buildPartnerAppearanceProfile(makeReport({
        pillars: {
          year: '경오',
          month: '을유',
          day: `갑${branch}`,
          hour: '정묘'
        }
      }))
    );

    expect(profiles.map((profile) => profile.spousePalace.branch)).toEqual(BRANCHES);
    expect(new Set(profiles.map((profile) => profile.imageFamily))).toEqual(
      new Set(['soft', 'sleek', 'strong', 'deep'])
    );

    const familyCounts = profiles.reduce<Record<string, number>>((counts, profile) => {
      counts[profile.imageFamily] = (counts[profile.imageFamily] || 0) + 1;
      return counts;
    }, {});

    expect(familyCounts).toEqual({
      sleek: 3,
      strong: 3,
      soft: 3,
      deep: 3
    });
  });
});

describe('partner appearance copy safety and evidence', () => {
  it('민족 고정관념·정확한 키·퍼센트·실제 얼굴 확정 표현을 노출하지 않는다', () => {
    for (const branch of BRANCHES) {
      const copy = customerVisibleAppearanceCopy(makeReport({
        pillars: {
          year: '경오',
          month: '을유',
          day: `갑${branch}`,
          hour: '정묘'
        }
      }));

      expect(copy).not.toMatch(/아랍상|중동인처럼|혼혈상/iu);
      expect(copy).not.toMatch(/\d{3}(?:\.\d+)?\s*cm/iu);
      expect(copy).not.toMatch(/\d+(?:\.\d+)?\s*%/u);
      expect(copy).not.toMatch(/실제\s*(?:미래\s*)?(?:배우자|인물)?(?:의\s*)?얼굴(?:입니다|이다|과\s*같습니다)/u);
      expect(copy).not.toMatch(/실제\s*얼굴\s*(?:그대로|확정|재현)/u);
      expect(copy).not.toMatch(/얼굴을\s*(?:확정합니다|확정했습니다|정확히\s*예측합니다|정확히\s*재현합니다)/u);
    }
  });

  it('외모 항목과 명리 근거를 빈값·중복·누락 없이 완전하게 연결한다', () => {
    const report = makeReport();
    const profile = buildPartnerAppearanceProfile(report);

    expect(profile.evidence.map((item) => item.source)).toEqual([
      'spouse-palace',
      'day-master',
      'helpful-element',
      'dominant-ten-god'
    ]);
    expect(new Set(profile.evidence.map((item) => item.source)).size).toBe(profile.evidence.length);

    for (const item of profile.evidence) {
      expect(item.label.trim()).not.toBe('');
      expect(item.value.trim()).not.toBe('');
    }

    const bySource = new Map(profile.evidence.map((item) => [item.source, item]));
    expect(bySource.get('spouse-palace')?.value).toContain(report.pillars.day);
    expect(bySource.get('spouse-palace')?.value).toContain(profile.spousePalace.branch);
    expect(bySource.get('spouse-palace')?.value).toContain(profile.spousePalace.element);
    expect(bySource.get('day-master')?.value).toContain(report.dayMaster);
    expect(bySource.get('day-master')?.value).toContain(report.dayMasterElement);
    for (const element of report.helpfulElements) {
      expect(bySource.get('helpful-element')?.value).toContain(element);
    }
    const dominantTenGods = [...report.tenGods]
      .sort((left, right) => right.value - left.value)
      .slice(0, 3);
    for (const tenGod of dominantTenGods) {
      expect(bySource.get('dominant-ten-god')?.value).toContain(tenGod.label);
    }
    expect(bySource.get('dominant-ten-god')?.value).not.toMatch(/\d+(?:\.\d+)?\s*%/u);

    expect(profile.headline).toContain(profile.height);
    expect(profile.headline).toContain(profile.faceShape);
    expect(profile.headline).toContain(profile.primaryArchetype.label);
    expect(profile.headline).toContain(profile.secondaryArchetype.label);
    expect(profile.traits).toEqual(expect.arrayContaining([
      profile.height,
      profile.build,
      profile.faceShape,
      profile.eyes,
      profile.brows,
      profile.nose,
      profile.lips,
      profile.complexion,
      profile.hair
    ]));
    expect(profile.traits.join(' ')).toContain(profile.primaryArchetype.label);
    expect(profile.traits.join(' ')).toContain(profile.secondaryArchetype.label);
    expect(profile.disclosure).toContain('창작 이미지 가이드');
    expect(profile.disclosure).toContain('확정하거나');
    expect(profile.disclosure).toContain('예측하지 않습니다');
  });
});
