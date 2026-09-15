import { describe, expect, it } from 'vitest';
import { createKoreanBirthProfile } from './profile';
import {
  analyzeGuiyeondoRelationship,
  assessGuiyeondoProfileStability,
  buildGuiyeondoBirthCalculation,
  guiyeondoSigilSeed
} from './relationshipAnalysis';

function exactProfile(input: {
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  birthTime: string;
}) {
  const profile = createKoreanBirthProfile({
    ...input,
    calendar: 'solar',
    isLeapMonth: false,
    isUnknownTime: false
  });
  if (!profile) throw new Error('테스트용 출생 프로필을 만들 수 없습니다.');
  return profile;
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  Object.entries(value).forEach(([key, item]) => {
    keys.push(key);
    collectKeys(item, keys);
  });
  return keys;
}

describe('귀연도 deterministic 관계 분석 계약', () => {
  const owner = exactProfile({
    name: '본인',
    gender: 'male',
    birthDate: '1992-09-09',
    birthTime: '10:24'
  });
  const guest = exactProfile({
    name: '상대',
    gender: 'female',
    birthDate: '2000-01-01',
    birthTime: '12:00'
  });

  it('같은 입력은 같은 명리 근거와 calculation fingerprint를 만든다', () => {
    const first = analyzeGuiyeondoRelationship(owner, guest);
    const second = analyzeGuiyeondoRelationship(owner, guest);

    expect(first).toEqual(second);
    expect(first.status).toBe('full');
    expect(first.calendarVersions.owner).toBeTruthy();
    expect(first.calendarVersions.guest).toBeTruthy();
    expect(first.compatibilityEngineVersion).toBe('2.0.0');
    expect(first.calculationFingerprint).toMatch(/^gy-[a-f0-9]{8}$/);
    expect(Object.keys(first.purposes).sort()).toEqual(['business', 'dating', 'family', 'marriage']);
  });

  it('23시 일주 경계와 해외 timezone·진태양시를 실제 계산 context에 전달한다', () => {
    const lateZi = { ...owner, birthDate: '2000-01-01', birthTime: '23:30', dayBoundaryPolicy: 'late-zi' as const };
    const midnight = { ...lateZi, dayBoundaryPolicy: 'midnight' as const };
    const lateZiCalculation = buildGuiyeondoBirthCalculation(lateZi);
    const midnightCalculation = buildGuiyeondoBirthCalculation(midnight);
    const overseas = buildGuiyeondoBirthCalculation({
      ...guest,
      location: 'New York',
      birthLocation: {
        label: 'New York',
        timezone: 'America/New_York',
        utcOffsetMinutes: -300,
        latitude: 40.7128,
        longitude: -74.006,
        applySolarTimeCorrection: true
      }
    });

    expect(lateZiCalculation.context.dayBoundaryPolicy).toBe('late-zi-next-day');
    expect(lateZiCalculation.trace?.dayBoundary.triggered).toBe(true);
    expect(midnightCalculation.context.dayBoundaryPolicy).toBe('civil-midnight');
    expect(midnightCalculation.trace?.dayBoundary.triggered).toBe(false);
    expect(lateZiCalculation.primary?.bazi.d_gz).not.toEqual(midnightCalculation.primary?.bazi.d_gz);
    expect(overseas.context.timezone).toMatchObject({ id: 'America/New_York', utcOffsetMinutes: -300 });
    expect(overseas.context.location).toMatchObject({ latitude: 40.7128, longitude: -74.006 });
    expect(overseas.context.trueSolarTime).toEqual({ enabled: true, includeEquationOfTime: true });
    expect(overseas.trace?.solarTimeCorrection.requested).toBe(true);
  });

  it('상대의 출생 입력이 달라지면 calculation fingerprint도 달라진다', () => {
    const changedGuest = exactProfile({
      name: '상대',
      gender: 'female',
      birthDate: '2000-01-02',
      birthTime: '12:00'
    });

    expect(analyzeGuiyeondoRelationship(owner, changedGuest).calculationFingerprint)
      .not.toBe(analyzeGuiyeondoRelationship(owner, guest).calculationFingerprint);
  });

  it('시간 미상으로 절입 경계를 가로지르면 dead-end 지도를 만들지 않도록 blocked 판정한다', () => {
    const boundary = createKoreanBirthProfile({
      name: '절입 경계',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '2024-02-04',
      birthTime: '',
      isUnknownTime: true
    });
    if (!boundary) throw new Error('경계 프로필을 만들 수 없습니다.');

    expect(assessGuiyeondoProfileStability(boundary)).toMatchObject({
      status: 'blocked',
      bazi: null
    });
  });

  it('표시 이름을 바꾸어도 같은 사주 원국은 같은 시각 인장을 만든다', () => {
    expect(guiyeondoSigilSeed(owner)).toBe(guiyeondoSigilSeed({ ...owner, name: '다른 닉네임' }));
    expect(guiyeondoSigilSeed(owner)).not.toBe(guiyeondoSigilSeed(guest));
  });

  it('표시 이름은 계산 FACT가 아니므로 calculation fingerprint를 바꾸지 않는다', () => {
    const renamedGuest = { ...guest, name: '다른 표시 이름' };

    expect(analyzeGuiyeondoRelationship(owner, renamedGuest).calculationFingerprint)
      .toBe(analyzeGuiyeondoRelationship(owner, guest).calculationFingerprint);
  });

  it('갈등 회복 차원의 방향을 뒤집지 않고 그대로 조정 압력에 연결한다', () => {
    const result = analyzeGuiyeondoRelationship(owner, guest);
    const sourceDimension = result.purposes.marriage.dimensions
      .find((dimension) => dimension.id === 'marriage-conflict-repair');
    const challenge = result.vectors.find((vector) => vector.id === 'challenge');

    expect(sourceDimension).toBeDefined();
    expect(challenge?.tendency).toBe(sourceDimension?.tendency);
  });

  it('검증 계약에 없는 0~100 점수나 확률 필드를 만들지 않는다', () => {
    const result = analyzeGuiyeondoRelationship(owner, guest);
    const forbiddenKeys = collectKeys(result).filter((key) => /score|probability|percent/i.test(key));

    expect(forbiddenKeys).toEqual([]);
    expect(result.vectors).toHaveLength(10);
    expect(result.vectors.find((vector) => vector.id === 'support')).toMatchObject({
      supported: false,
      tendency: 'insufficient',
      confidence: 0,
      evidenceIds: []
    });
    expect(result.vectors.find((vector) => vector.id === 'growth')).toMatchObject({
      supported: false,
      tendency: 'insufficient',
      confidence: 0,
      evidenceIds: []
    });
  });

  it('지원되지 않는 성장 벡터를 다른 긍정 신호로 대신해 성장인연을 만들지 않는다', () => {
    const first = exactProfile({ name: 'A', gender: 'male', birthDate: '1970-04-16', birthTime: '12:00' });
    const second = exactProfile({ name: 'B', gender: 'female', birthDate: '1990-10-12', birthTime: '12:00' });
    const result = analyzeGuiyeondoRelationship(first, second);

    expect(result.vectors.find((vector) => vector.id === 'growth')).toMatchObject({
      supported: false,
      tendency: 'insufficient'
    });
    expect(result.classification.type).not.toBe('growth-relation');
  });

  it('관계 유형은 확정 예언이 아닌 버전 있는 provisional 분류로만 노출한다', () => {
    const result = analyzeGuiyeondoRelationship(owner, guest);

    if (result.classification.type) {
      expect(result.classification).toMatchObject({
        status: 'provisional',
        policyVersion: 'guiyeondo-exploration-v0.1'
      });
      expect(result.classification.evidenceIds.length).toBeGreaterThan(0);
      expect(result.classification.evidenceIds.every((id) =>
        result.vectors.some((vector) => vector.evidenceIds.includes(id))
      )).toBe(true);
    } else {
      expect(result.classification).toMatchObject({
        status: 'insufficient',
        policyVersion: null,
        evidenceIds: []
      });
    }
    expect(result.uncertainty.join(' ')).toContain('확정하지 않습니다');
    expect(result.uncertainty.join(' ')).toContain('0~100 궁합 확률');
  });
});
