import { describe, expect, it } from 'vitest';
import { buildDailyFortune, koreanDateKey } from './dailyFortune';

const base = {
  name: '운월',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1996-03-04',
  birthTime: '09:20',
  isUnknownTime: false,
  birthTimePrecision: 'exact' as const
};

describe('오늘의 운세', () => {
  it('같은 사람 같은 날이면 몇 번을 열어도 같은 글이다', () => {
    /* 하루에 두 번 열었을 때 운세가 바뀌면 그건 운세가 아니다. 난수도 시각 의존도 없어야 한다. */
    expect(buildDailyFortune(base, '2026-09-22')).toEqual(buildDailyFortune(base, '2026-09-22'));
  });

  it('날짜가 바뀌면 일진이 바뀐다', () => {
    const today = buildDailyFortune(base, '2026-09-22');
    const tomorrow = buildDailyFortune(base, '2026-09-23');

    expect(today?.dayPillar.label).not.toBe(tomorrow?.dayPillar.label);
    expect(today?.dateKey).toBe('2026-09-22');
  });

  it('일진은 60갑자 주기로 돌아온다', () => {
    const day = buildDailyFortune(base, '2026-09-22');
    // 60일 뒤 같은 간지. 일진 계산이 날짜에서 제대로 나오는지 보는 값싼 검산이다.
    const after60 = buildDailyFortune(base, '2026-11-21');

    expect(after60?.dayPillar.label).toBe(day?.dayPillar.label);
  });

  it('사람이 다르면 같은 날도 다르게 읽힌다', () => {
    const other = buildDailyFortune({ ...base, birthDate: '1988-11-17' }, '2026-09-22');
    const mine = buildDailyFortune(base, '2026-09-22');

    // 일진은 같지만 내 원국과 맺는 관계가 다르므로 십신이 달라진다.
    expect(other?.dayPillar.label).toBe(mine?.dayPillar.label);
    expect(other?.tenGod.stem).not.toBe(mine?.tenGod.stem);
  });

  it('0~100 점수를 만들지 않는다 — 센 개수와 세 단계만 쓴다', () => {
    const fortune = buildDailyFortune(base, '2026-09-22');

    expect(fortune).not.toHaveProperty('score');
    expect(['supportive', 'steady', 'caution']).toContain(fortune?.tone);
    expect(fortune?.tally.integrative).toBeGreaterThanOrEqual(0);
    expect(fortune?.tally.friction).toBeGreaterThanOrEqual(0);
    // 검출된 관계 수와 센 수가 어긋나면 화면의 근거가 거짓이 된다.
    expect(fortune!.tally.integrative + fortune!.tally.friction).toBeLessThanOrEqual(
      fortune!.relations.length
    );
  });

  it('마찰이 더 많으면 조심, 통합이 더 많으면 순풍, 같으면 무난이다', () => {
    for (const dateKey of ['2026-09-22', '2026-10-05', '2026-12-31', '2027-03-11']) {
      const fortune = buildDailyFortune(base, dateKey)!;
      const { integrative, friction } = fortune.tally;

      if (friction > integrative) expect(fortune.tone).toBe('caution');
      else if (integrative > friction) expect(fortune.tone).toBe('supportive');
      else expect(fortune.tone).toBe('steady');
    }
  });

  it('활성화된 영역이 목록 위로 온다', () => {
    const areas = buildDailyFortune(base, '2026-09-22')!.areas;

    expect(areas).toHaveLength(4);
    const firstInactive = areas.findIndex((area) => !area.active);
    if (firstInactive !== -1) {
      expect(areas.slice(firstInactive).every((area) => !area.active)).toBe(true);
    }
    expect(areas.some((area) => area.active)).toBe(true);
  });

  it('출생시간이 미상이면 그 사실을 적고 계산은 계속한다', () => {
    const fortune = buildDailyFortune({ ...base, isUnknownTime: true, birthTime: '' }, '2026-09-22');

    expect(fortune).not.toBeNull();
    expect(fortune?.uncertainty.some((note) => note.includes('출생시간'))).toBe(true);
  });

  it('출생정보가 없거나 깨지면 만들지 않는다', () => {
    expect(buildDailyFortune(null, '2026-09-22')).toBeNull();
    expect(buildDailyFortune({}, '2026-09-22')).toBeNull();
    expect(buildDailyFortune(base, '2026-9-22')).toBeNull();
  });

  it('근거 문장에 내부 참가자 id 가 새지 않는다', () => {
    /* 엔진의 `description` 은 `ilun luckbranch 해 · natal monthbranch 인 …` 처럼 추적용
       id 를 담는다. 그대로 화면에 내보내면 손님이 코드를 읽게 된다. */
    for (const dateKey of ['2026-09-22', '2026-10-05', '2026-11-30']) {
      for (const relation of buildDailyFortune(base, dateKey)!.relations) {
        expect(relation.sentence).not.toMatch(/ilun|natal|luckbranch|monthbranch|:stem|:branch/);
        expect(relation.sentence).toMatch(/^오늘의 /);
      }
    }
  });

  it('요약과 영역 문장이 같은 글이 아니다', () => {
    // 같은 문장이 두 번 나오면 한 번은 헛읽는다.
    const fortune = buildDailyFortune(base, '2026-09-22')!;

    expect(fortune.areas.map((area) => area.statement)).not.toContain(fortune.summary);
  });

  it('주격 조사를 받침에 맞게 붙인다 — 화면에 "이(가)" 가 남지 않는다', () => {
    for (const dateKey of ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']) {
      const fortune = buildDailyFortune(base, dateKey)!;
      const allText = [fortune.summary, ...fortune.areas.map((area) => area.statement),
        ...fortune.relations.map((relation) => relation.sentence)].join(' ');

      expect(allText).not.toContain('이(가)');
      expect(allText).not.toContain('(를)');
    }
    // 받침 있는 말은 '이', 없는 말은 '가'.
    expect(buildDailyFortune(base, '2026-09-22')!.summary).toBeTruthy();
  });

  it('KST 로 날짜를 센다', () => {
    // UTC 로는 21일 22시지만 한국은 이미 22일이다.
    expect(koreanDateKey(new Date('2026-09-21T22:00:00Z'))).toBe('2026-09-22');
    expect(koreanDateKey(new Date('2026-09-21T14:59:00Z'))).toBe('2026-09-21');
  });
});
