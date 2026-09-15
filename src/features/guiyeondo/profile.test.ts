import { describe, expect, it } from 'vitest';
import { createKoreanBirthProfile, isGuiyeondoProfileAtLeastAge, toGuiyeondoBirthProfile } from './profile';

describe('귀연도 출생 프로필 정규화', () => {
  it('한국 입력을 deterministic calendar 계약으로 변환한다', () => {
    expect(createKoreanBirthProfile({
      name: '  홍길동  ',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '2000-01-01',
      birthTime: '09:30',
      isUnknownTime: false
    })).toMatchObject({
      name: '홍길동',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '2000-01-01',
      birthTime: '09:30',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'midnight',
      location: '대한민국 · 표준시',
      birthLocation: {
        timezone: 'Asia/Seoul',
        utcOffsetMinutes: 540,
        applySolarTimeCorrection: false
      }
    });
  });

  it('23시대 직접 입력에서 사용자가 선택한 일주 경계 정책을 보존한다', () => {
    expect(createKoreanBirthProfile({
      name: '경계 입력',
      gender: 'female',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '2000-01-01',
      birthTime: '23:30',
      isUnknownTime: false,
      dayBoundaryPolicy: 'late-zi'
    })?.dayBoundaryPolicy).toBe('late-zi');
  });

  it('음력 윤달과 시간 모름을 서로 독립된 canonical 필드로 보존한다', () => {
    expect(createKoreanBirthProfile({
      name: '윤달 입력',
      gender: 'female',
      calendar: 'lunar',
      isLeapMonth: true,
      birthDate: '2017-06-01',
      birthTime: '',
      isUnknownTime: true
    })).toMatchObject({
      calendar: 'lunar',
      isLeapMonth: true,
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    });
  });

  it('기존 리포트의 해외 timezone과 진태양시 설정을 임의로 덮어쓰지 않는다', () => {
    const profile = toGuiyeondoBirthProfile({
      name: '해외 출생',
      gender: 'female',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '2000-01-01',
      birthTime: '03:30',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'midnight',
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

    expect(profile?.birthLocation).toEqual({
      label: 'New York',
      timezone: 'America/New_York',
      utcOffsetMinutes: -300,
      latitude: 40.7128,
      longitude: -74.006,
      applySolarTimeCorrection: true
    });
    expect(profile?.location).toBe('New York');
  });

  it('구조화된 timezone이 없는 해외 레거시 지역을 서울로 추측하지 않는다', () => {
    const legacyOverseas = {
      name: '해외 레거시',
      gender: 'female' as const,
      calendar: 'solar' as const,
      isLeapMonth: false,
      birthDate: '2000-01-01',
      birthTime: '03:30',
      isUnknownTime: false,
      birthTimePrecision: 'exact' as const
    };

    expect(toGuiyeondoBirthProfile({ ...legacyOverseas, location: 'New York' })).toBeNull();
    expect(toGuiyeondoBirthProfile({ ...legacyOverseas, location: '서울' })?.birthLocation.timezone).toBe('Asia/Seoul');
  });

  it('기존 리포트의 23시 일주 경계 정책을 귀연도에서도 그대로 보존한다', () => {
    const profile = toGuiyeondoBirthProfile({
      name: '야자시 정책',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1992-09-09',
      birthTime: '23:30',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'late-zi',
      location: '대한민국 · 표준시'
    });

    expect(profile?.dayBoundaryPolicy).toBe('late-zi');
  });

  it('필수 FACT가 없거나 모순된 입력을 프로필로 만들지 않는다', () => {
    const base = {
      name: '입력자',
      gender: 'male' as const,
      calendar: 'solar' as const,
      isLeapMonth: false,
      birthDate: '2000-01-01',
      birthTime: '09:30',
      isUnknownTime: false,
      birthTimePrecision: 'exact' as const
    };

    expect(toGuiyeondoBirthProfile({ ...base, name: '' })).toBeNull();
    expect(toGuiyeondoBirthProfile({ ...base, gender: '' })).toBeNull();
    expect(toGuiyeondoBirthProfile({ ...base, isLeapMonth: true })).toBeNull();
    expect(toGuiyeondoBirthProfile({
      ...base,
      birthTime: '09:00~11:00',
      birthTimePrecision: 'branch-range'
    })).toBeNull();
  });

  it('프로덕션 달력 검증 결과의 생일 기준으로 만 14세 여부를 판정한다', () => {
    const adult = createKoreanBirthProfile({ name: '성인', gender: 'female', calendar: 'solar', isLeapMonth: false, birthDate: '2000-01-01', birthTime: '12:00', isUnknownTime: false });
    const child = createKoreanBirthProfile({ name: '아동', gender: 'male', calendar: 'solar', isLeapMonth: false, birthDate: '2020-01-01', birthTime: '12:00', isUnknownTime: false });
    expect(adult && isGuiyeondoProfileAtLeastAge(adult, 14, new Date('2026-09-15T00:00:00.000Z'))).toBe(true);
    expect(child && isGuiyeondoProfileAtLeastAge(child, 14, new Date('2026-09-15T00:00:00.000Z'))).toBe(false);
  });
});
