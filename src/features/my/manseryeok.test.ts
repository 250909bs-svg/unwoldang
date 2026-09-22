import { describe, expect, it } from 'vitest';
import { buildManseryeokChart } from './manseryeok';

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

describe('내 만세력', () => {
  it('출생정보 한 건으로 네 기둥을 세운다', () => {
    const chart = buildManseryeokChart(base);

    expect(chart).not.toBeNull();
    expect(chart?.pillars.map((pillar) => pillar.label)).toEqual(['연주', '월주', '일주', '시주']);
    // 각 기둥은 천간 한 글자 + 지지 한 글자다.
    for (const pillar of chart!.pillars) {
      expect(pillar.stem).toHaveLength(1);
      expect(pillar.branch).toHaveLength(1);
    }
    expect(chart?.hourKnown).toBe(true);
    expect(chart?.zodiac).toBeTruthy();
    expect(chart?.dayMaster.stem).toHaveLength(1);
  });

  it('시간 미상이면 시주를 세우지 않는다 — 자시로 가정하지 않는다', () => {
    const chart = buildManseryeokChart({ ...base, isUnknownTime: true, birthTime: '' });

    expect(chart?.hourKnown).toBe(false);
    expect(chart?.pillars.map((pillar) => pillar.label)).toEqual(['연주', '월주', '일주']);
  });

  it('birthTimePrecision 이 unknown 이면 시간 문자열이 남아 있어도 시주를 뺀다', () => {
    /* 초안에 옛 시간이 남은 채 "시간 모름" 으로 바뀌는 경우가 있다. 그 값을 쓰면
       사용자가 모른다고 한 것을 아는 척하게 된다. */
    const chart = buildManseryeokChart({
      ...base,
      birthTimePrecision: 'unknown',
      isUnknownTime: false
    });

    expect(chart?.hourKnown).toBe(false);
  });

  it('같은 입력이면 같은 원국이다', () => {
    expect(buildManseryeokChart(base)).toEqual(buildManseryeokChart(base));
  });

  it('음력 입력과 양력 입력은 다른 원국을 낸다', () => {
    const solar = buildManseryeokChart(base);
    const lunar = buildManseryeokChart({ ...base, calendar: 'lunar' });

    expect(lunar).not.toBeNull();
    expect(lunar?.basis.solarDate).not.toBe(solar?.basis.solarDate);
  });

  it('출생정보가 없거나 형식이 깨지면 원국을 세우지 않는다', () => {
    expect(buildManseryeokChart(null)).toBeNull();
    expect(buildManseryeokChart({})).toBeNull();
    expect(buildManseryeokChart({ ...base, birthDate: '1996-3-4' })).toBeNull();
    expect(buildManseryeokChart({ ...base, birthDate: '1996-13-04' })).toBeNull();
  });

  it('깨진 시간은 시주만 빼고 나머지는 세운다', () => {
    const chart = buildManseryeokChart({ ...base, birthTime: '25:00' });

    expect(chart).not.toBeNull();
    expect(chart?.hourKnown).toBe(false);
  });

  it('강약 비율은 게이지에 넣을 수 있는 0~1 범위다', () => {
    const chart = buildManseryeokChart(base);

    expect(chart?.strength.ratio).toBeGreaterThanOrEqual(0);
    expect(chart?.strength.ratio).toBeLessThanOrEqual(1);
    expect(chart?.strength.label).toBeTruthy();
  });

  it('이름이 비어도 화면이 빈칸을 보이지 않는다', () => {
    expect(buildManseryeokChart({ ...base, name: '   ' })?.name).toBe('나');
  });
});
