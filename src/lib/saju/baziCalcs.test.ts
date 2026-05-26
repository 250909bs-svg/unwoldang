import { describe, expect, it } from 'vitest';
import { DZ, TG } from './constants';
import {
  calcBazi,
  daymasterStrength,
  dayunRows,
  fiveElementDistribution,
  getDayMasterElement,
  seunRows,
  tenGodDistribution,
  usefulElements
} from './baziCalcs';

function parseAgeRange(ageText: string) {
  const [startText, endText] = ageText.replace(/\s/g, '').split('~');
  return {
    start: Number(startText.replace(/\D/g, '')),
    end: Number(endText.replace(/\D/g, ''))
  };
}

describe('saju core engine regression coverage', () => {
  it('calculates known four pillars for a fixed KST solar datetime', () => {
    const bazi = calcBazi(1990, 1, 1, 12, 30, 'solar', 'normal', 'male', false);

    // 1990-01-01 12:30 KST is before ipchun, so astrological year remains previous cycle.
    expect(bazi.y_gz).toEqual({ tg: 5, dz: 5 }); // 己巳
    expect(bazi.m_gz).toEqual({ tg: 2, dz: 0 }); // 丙子
    expect(bazi.d_gz).toEqual({ tg: 2, dz: 2 }); // 丙寅
    expect(bazi.h_gz).toEqual({ tg: 0, dz: 6 }); // 甲午
    expect(bazi.solar).toEqual([1990, 1, 1]);
    expect(bazi.calculationBasis.ipchun).toContain('.');
  });

  it('keeps hour pillar null when birth time is unknown', () => {
    const withUnknownTime = calcBazi(1990, 1, 1, null, null, 'solar', 'normal', 'female', false);
    expect(withUnknownTime.h_gz).toBeNull();
    expect(withUnknownTime.d_gz).toEqual({ tg: 2, dz: 2 });
  });

  it('produces opposite daeyun directions for male/female on the same birth', () => {
    const male = calcBazi(1990, 1, 1, 12, 30, 'solar', 'normal', 'male', false);
    const female = calcBazi(1990, 1, 1, 12, 30, 'solar', 'normal', 'female', false);
    // 1990-01-01 is still 己巳 astrological year before ipchun. Male + yin year runs backward, female + yin year runs forward.
    expect(male.forward).toBe(false);
    expect(female.forward).toBe(true);
    expect(male.forward).not.toBe(female.forward);
  });

  it('builds ten daeyun rows with deterministic age and ganzhi progression', () => {
    const bazi = calcBazi(1990, 1, 1, 12, 30, 'solar', 'normal', 'female', false);
    const rows = dayunRows(bazi);

    expect(rows).toHaveLength(10);
    rows.forEach((row, index) => {
      expect(row.period).toBe(index + 1);
      const range = parseAgeRange(row.age);
      expect(range.end - range.start).toBe(9);
      if (index > 0) {
        const prevRange = parseAgeRange(rows[index - 1].age);
        expect(range.start - prevRange.start).toBe(10);
        expect(row.year - rows[index - 1].year).toBe(10);
      }
    });

    let stem = bazi.m_gz.tg;
    let branch = bazi.m_gz.dz;
    for (let index = 0; index < rows.length; index += 1) {
      stem = bazi.forward ? (stem + 1) % 10 : (stem + 9) % 10;
      branch = bazi.forward ? (branch + 1) % 12 : (branch + 11) % 12;
      expect(rows[index].ganzhi).toBe(`${TG[stem]}${DZ[branch]}`);
    }
  });

  it('matches the API dayun sequence for the life-flow preview sample', () => {
    const bazi = calcBazi(1992, 9, 9, 10, 24, 'solar', 'normal', 'male', false);
    const rows = dayunRows(bazi);

    expect(bazi.forward).toBe(true);
    expect(rows[2].ganzhi).toBe('임자');
    expect(rows[2].age).toBe('29세 ~ 38세');
    expect(rows[3].ganzhi).toBe('계축');
    expect(rows[3].age).toBe('39세 ~ 48세');
  });

  it('generates yearly luck rows as a continuous sexagenary sequence', () => {
    const rows = seunRows(2026, 12);

    expect(rows).toHaveLength(12);
    rows.forEach((row, index) => {
      const year = 2026 + index;
      const stem = ((year - 4) % 10 + 10) % 10;
      const branch = ((year - 4) % 12 + 12) % 12;
      expect(row.year).toBe(year);
      expect(row.ganzhi).toBe(`${TG[stem]}${DZ[branch]}`);
    });
  });

  it('returns valid distributions and strength metadata', () => {
    const bazi = calcBazi(1995, 8, 17, 9, 45, 'solar', 'normal', 'female', false);
    const tenGods = tenGodDistribution(bazi);
    const elementDistribution = fiveElementDistribution(bazi.y_gz, bazi.m_gz, bazi.d_gz, bazi.h_gz);
    const [ratio, label, reasons] = daymasterStrength(bazi);
    const [helpful, cautious] = usefulElements(getDayMasterElement(bazi.d_gz.tg), label);

    expect(Object.values(tenGods).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
    expect(Object.values(elementDistribution).reduce((sum, value) => sum + value, 0)).toBe(8);
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(1);
    expect(label.length).toBeGreaterThan(0);
    expect(reasons.length).toBeGreaterThan(0);
    expect(new Set(helpful).size).toBe(helpful.length);
    expect(new Set(cautious).size).toBe(cautious.length);
  });
});
