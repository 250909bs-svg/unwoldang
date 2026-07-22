import type { DeterministicSajuBasis } from '../deterministicBasis';
import type { SajuReportData } from '../report';

export interface NarrativeFactAllowlist {
  ganzhi: ReadonlySet<string>;
  years: ReadonlySet<number>;
  dayMasters: ReadonlySet<string>;
}

export interface NarrativeFactViolation {
  code: 'unsupported-ganzhi' | 'unsupported-year' | 'unsupported-day-master';
  token: string;
  path: string;
  message: string;
}

const STEMS = '갑을병정무기경신임계';
const BRANCHES = '자축인묘진사오미신유술해';
const HANJA_STEMS = '甲乙丙丁戊己庚辛壬癸';
const HANJA_BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const FACT_SUFFIX = '년주|월주|일주|시주|대운|세운|월운|년';
const FACT_PREFIX = '년주|월주|일주|시주|대운|세운|월운';
const GANZHI_PATTERNS = [
  new RegExp(`([${STEMS}][${BRANCHES}])\\s*(?:${FACT_SUFFIX})`, 'g'),
  new RegExp(`(?:${FACT_PREFIX})\\s*(?:은|는|이|가|:)?\\s*([${STEMS}][${BRANCHES}])`, 'g'),
  new RegExp(`([${HANJA_STEMS}][${HANJA_BRANCHES}])\\s*(?:${FACT_SUFFIX})`, 'g'),
  new RegExp(`(?:${FACT_PREFIX})\\s*(?:은|는|이|가|:)?\\s*([${HANJA_STEMS}][${HANJA_BRANCHES}])`, 'g')
] as const;
const DAY_MASTER_PATTERNS = [
  new RegExp(`([${STEMS}])(?:목|화|토|금|수)?\\s*일간`, 'g'),
  new RegExp(`일간\\s*(?:은|는|이|가|:)?\\s*([${STEMS}])`, 'g')
] as const;
const EXPLICIT_YEAR = /((?:18|19|20|21)\d{2})\s*년/g;

function normalizeGanzhiToken(token: string) {
  if (token.length !== 2) return token;
  const stemIndex = HANJA_STEMS.indexOf(token[0]);
  const branchIndex = HANJA_BRANCHES.indexOf(token[1]);
  return stemIndex >= 0 && branchIndex >= 0
    ? `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
    : token;
}

function addGanzhi(target: Set<string>, value: string | null | undefined) {
  const token = value?.trim();
  if (token && token.length === 2 && STEMS.includes(token[0]) && BRANCHES.includes(token[1])) {
    target.add(token);
  }
}

function addYearsFromText(target: Set<number>, value: string | null | undefined) {
  if (!value) return;
  for (const match of value.matchAll(/(?:18|19|20|21)\d{2}/g)) {
    target.add(Number(match[0]));
  }
}

/** Builds an allowlist only from trusted structured fields, never customer questions/free text. */
export function buildNarrativeFactAllowlist(
  base: SajuReportData,
  basis?: DeterministicSajuBasis
): NarrativeFactAllowlist {
  const ganzhi = new Set<string>();
  const years = new Set<number>();
  const dayMasters = new Set<string>();

  Object.values(base.pillars).forEach((value) => addGanzhi(ganzhi, value));
  base.yearLuck.forEach((item) => {
    addGanzhi(ganzhi, item.ganzhi);
    years.add(item.year);
  });
  base.monthLuck.forEach((item) => {
    addGanzhi(ganzhi, item.ganzhi);
    years.add(item.year);
  });
  addYearsFromText(years, base.currentDayun.range);
  addYearsFromText(years, base.nextDayun.range);
  if (STEMS.includes(base.dayMaster)) dayMasters.add(base.dayMaster);

  if (basis) {
    Object.values(basis.pillars).forEach((value) => addGanzhi(ganzhi, value));
    basis.dayun.forEach((item) => {
      addGanzhi(ganzhi, item.ganzhi);
      years.add(item.year);
    });
    basis.seun.forEach((item) => {
      addGanzhi(ganzhi, item.ganzhi);
      years.add(item.year);
    });
    addGanzhi(ganzhi, basis.commercialV2.luckContext.currentDayun?.ganzhi);
    addGanzhi(ganzhi, basis.commercialV2.luckContext.nextDayun?.ganzhi);
    addGanzhi(ganzhi, basis.commercialV2.luckContext.currentSeun.ganzhi);
    addGanzhi(ganzhi, basis.commercialV2.luckContext.currentWolyun.ganzhi);
    basis.commercialV2.calendar.scenarioPillars.forEach((scenario) => {
      addGanzhi(ganzhi, scenario.year);
      addGanzhi(ganzhi, scenario.month);
      addGanzhi(ganzhi, scenario.day);
      addGanzhi(ganzhi, scenario.hour);
    });
    basis.commercialV2.partner?.calendar.scenarioPillars.forEach((scenario) => {
      addGanzhi(ganzhi, scenario.year);
      addGanzhi(ganzhi, scenario.month);
      addGanzhi(ganzhi, scenario.day);
      addGanzhi(ganzhi, scenario.hour);
    });
    const birthYear = Number(basis.input.birthDate.slice(0, 4));
    if (Number.isInteger(birthYear)) years.add(birthYear);
    years.add(basis.commercialV2.generatedFor.year);
    dayMasters.add(basis.dayMaster.stem);
  }

  return { ganzhi, years, dayMasters };
}

function narrativeStrings(value: unknown) {
  const result: Array<{ path: string; text: string }> = [];
  const seen = new WeakSet<object>();

  const visit = (item: unknown, path: string) => {
    if (typeof item === 'string') {
      result.push({ path, text: item });
      return;
    }
    if (!item || typeof item !== 'object' || seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
    } else {
      Object.entries(item as Record<string, unknown>)
        .forEach(([key, child]) => visit(child, `${path}.${key}`));
    }
  };

  visit(value, '$');
  return result;
}

export function findNarrativeFactViolations(
  narrative: unknown,
  allowlist: NarrativeFactAllowlist
): NarrativeFactViolation[] {
  const violations: NarrativeFactViolation[] = [];
  const seen = new Set<string>();
  const push = (violation: NarrativeFactViolation) => {
    const key = `${violation.code}|${violation.token}|${violation.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      violations.push(violation);
    }
  };

  for (const { path, text } of narrativeStrings(narrative)) {
    for (const pattern of GANZHI_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const token = normalizeGanzhiToken(match[1]);
        if (!allowlist.ganzhi.has(token)) {
          push({
            code: 'unsupported-ganzhi',
            token,
            path,
            message: `제공되지 않은 간지 ${token}를 계산 사실처럼 서술했습니다.`
          });
        }
      }
    }

    EXPLICIT_YEAR.lastIndex = 0;
    for (const match of text.matchAll(EXPLICIT_YEAR)) {
      const year = Number(match[1]);
      if (!allowlist.years.has(year)) {
        push({
          code: 'unsupported-year',
          token: String(year),
          path,
          message: `제공되지 않은 연도 ${year}년을 계산 사실처럼 서술했습니다.`
        });
      }
    }

    for (const pattern of DAY_MASTER_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const token = match[1];
        if (!allowlist.dayMasters.has(token)) {
          push({
            code: 'unsupported-day-master',
            token,
            path,
            message: `제공되지 않은 ${token} 일간을 계산 사실처럼 서술했습니다.`
          });
        }
      }
    }
  }

  return violations;
}
