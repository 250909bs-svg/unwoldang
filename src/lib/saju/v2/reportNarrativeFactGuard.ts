import type { DeterministicSajuBasis } from '../deterministicBasis';
import type { SajuReportData } from '../report';

export interface NarrativeFactAllowlist {
  ganzhi: ReadonlySet<string>;
  years: ReadonlySet<number>;
  dayMasters: ReadonlySet<string>;
  elementValues: ReadonlyMap<string, ReadonlySet<number>>;
  helpfulElements: ReadonlySet<string>;
  strengthLabels: ReadonlySet<string>;
  dayunStartAges: ReadonlySet<number>;
  calendarPolicies: ReadonlySet<string>;
}

export interface NarrativeFactViolation {
  code:
    | 'unsupported-ganzhi'
    | 'unsupported-year'
    | 'unsupported-day-master'
    | 'unsupported-element-value'
    | 'unsupported-helpful-element'
    | 'unsupported-strength-label'
    | 'unsupported-dayun-start-age'
    | 'unsupported-calendar-policy';
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
const ELEMENTS = '\uBAA9\uD654\uD1A0\uAE08\uC218';
const ELEMENT_VALUE_PATTERN = new RegExp(
  `([${ELEMENTS}])\\s*(?:\\uC624\\uD589|\\uAE30\\uC6B4|\\uBD84\\uD3EC)?\\s*` +
  `(?:\\uC740|\\uB294|\\uC774|\\uAC00)?\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*` +
  `(?:\\uAC1C|\\uC810|%)`,
  'g'
);
const HELPFUL_ELEMENT_PATTERN = new RegExp(
  `(?:\\uC6A9\\uC2E0|\\uD76C\\uC2E0|\\uB3C4\\uC6C0\\s*(?:\\uC774\\s*\\uB418\\uB294)?` +
  `\\s*(?:\\uC624\\uD589|\\uAE30\\uC6B4|\\uC694\\uC18C))\\s*` +
  `(?:\\uC624\\uD589|\\uAE30\\uC6B4|\\uC694\\uC18C)?\\s*` +
  `(?:\\uC740|\\uB294|\\uC774|\\uAC00|\\uC73C\\uB85C|\\uB85C)?\\s*[:=]?\\s*` +
  `([${ELEMENTS}])`,
  'g'
);
const STRENGTH_LABELS = ['\uC2E0\uAC15', '\uC2E0\uC57D', '\uC911\uD654'] as const;
const STRENGTH_PATTERNS = [
  new RegExp(
    `(${STRENGTH_LABELS.join('|')})\\s*(?:\\uC0AC\\uC8FC|\\uBA85\\uC2DD|\\uC6D0\\uAD6D|\\uAD6C\\uC870)`,
    'g'
  ),
  new RegExp(
    `(?:\\uC0AC\\uC8FC|\\uBA85\\uC2DD|\\uC6D0\\uAD6D|\\uAD6C\\uC870)\\s*` +
    `(?:\\uC740|\\uB294|\\uC774|\\uAC00)?\\s*(${STRENGTH_LABELS.join('|')})`,
    'g'
  )
] as const;
const DAYUN_START_AGE_PATTERN = new RegExp(
  `\\uB300\\uC6B4\\s*(?:\\uC2DC\\uC791)?\\s*(?:\\uB098\\uC774|\\uC5F0\\uB839)?\\s*` +
  `(?:\\uC740|\\uB294|\\uC774|\\uAC00)?\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*\\uC138`,
  'g'
);
const CALENDAR_POLICY_PATTERN = /\b(civil-midnight|late-zi-next-day)\b/g;

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

function normalizedFactNumber(value: number | string) {
  return Number(Number(value).toFixed(6));
}

function addElementValue(
  target: Map<string, Set<number>>,
  element: string,
  value: number
) {
  if (!ELEMENTS.includes(element) || !Number.isFinite(value)) return;
  const values = target.get(element) || new Set<number>();
  values.add(normalizedFactNumber(value));
  target.set(element, values);
}

function addStrengthLabel(target: Set<string>, value: string | null | undefined) {
  if (!value) return;
  STRENGTH_LABELS.forEach((label) => {
    if (value.includes(label)) target.add(label);
  });
}

function addDayunStartAge(target: Set<number>, value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return;
  target.add(normalizedFactNumber(value));
  target.add(Math.round(value));
}

/** Builds an allowlist only from trusted structured fields, never customer questions/free text. */
export function buildNarrativeFactAllowlist(
  base: SajuReportData,
  basis?: DeterministicSajuBasis
): NarrativeFactAllowlist {
  const ganzhi = new Set<string>();
  const years = new Set<number>();
  const dayMasters = new Set<string>();
  const elementValues = new Map<string, Set<number>>();
  const helpfulElements = new Set<string>();
  const strengthLabels = new Set<string>();
  const dayunStartAges = new Set<number>();
  const calendarPolicies = new Set<string>();

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
  base.fiveElements.forEach(({ label, value }) => addElementValue(elementValues, label, value));
  base.helpfulElements.forEach((element) => helpfulElements.add(element));
  addStrengthLabel(strengthLabels, base.strengthLabel);

  if (basis) {
    Object.values(basis.pillars).forEach((value) => addGanzhi(ganzhi, value));
    basis.dayun.forEach((item) => {
      addGanzhi(ganzhi, item.ganzhi);
      years.add(item.year);
      addDayunStartAge(dayunStartAges, item.startAgeExact);
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
    basis.fiveElements.forEach(({ label, value }) => addElementValue(elementValues, label, value));
    basis.helpfulElements.forEach((element) => helpfulElements.add(element));
    addStrengthLabel(strengthLabels, basis.strength.label);
    calendarPolicies.add(basis.input.dayBoundaryPolicy);
    calendarPolicies.add(basis.commercialV2.calendar.dayBoundaryPolicy);
  }

  return {
    ganzhi,
    years,
    dayMasters,
    elementValues,
    helpfulElements,
    strengthLabels,
    dayunStartAges,
    calendarPolicies
  };
}

const IMMUTABLE_STRUCTURAL_PATHS = [
  /^\$\.questionAnswers\[\d+\]\.question$/,
  /^\$\.keyTakeaways\[\d+\]\.title$/,
  /^\$\.sections\[\d+\]\.id$/,
  /^\$\.sections\[\d+\]\.cards\[\d+\]\.title$/,
  /^\$\.sections\[\d+\]\.details\[\d+\]\.summary$/
] as const;

function narrativeStrings(value: unknown) {
  const result: Array<{ path: string; text: string }> = [];
  const seen = new WeakSet<object>();

  const visit = (item: unknown, path: string) => {
    if (typeof item === 'string') {
      if (!IMMUTABLE_STRUCTURAL_PATHS.some((pattern) => pattern.test(path))) {
        result.push({ path, text: item });
      }
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

    ELEMENT_VALUE_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(ELEMENT_VALUE_PATTERN)) {
      const element = match[1];
      const value = normalizedFactNumber(match[2]);
      if (!allowlist.elementValues.get(element)?.has(value)) {
        push({
          code: 'unsupported-element-value',
          token: `${element}:${value}`,
          path,
          message: `Narrative states an unsupported ${element} element value (${value}).`
        });
      }
    }

    HELPFUL_ELEMENT_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(HELPFUL_ELEMENT_PATTERN)) {
      const element = match[1];
      if (!allowlist.helpfulElements.has(element)) {
        push({
          code: 'unsupported-helpful-element',
          token: element,
          path,
          message: `Narrative states unsupported helpful element ${element}.`
        });
      }
    }

    for (const pattern of STRENGTH_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const label = match[1];
        if (!allowlist.strengthLabels.has(label)) {
          push({
            code: 'unsupported-strength-label',
            token: label,
            path,
            message: `Narrative states unsupported strength label ${label}.`
          });
        }
      }
    }

    DAYUN_START_AGE_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(DAYUN_START_AGE_PATTERN)) {
      const age = normalizedFactNumber(match[1]);
      if (!allowlist.dayunStartAges.has(age)) {
        push({
          code: 'unsupported-dayun-start-age',
          token: String(age),
          path,
          message: `Narrative states unsupported dayun start age ${age}.`
        });
      }
    }

    CALENDAR_POLICY_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(CALENDAR_POLICY_PATTERN)) {
      const policy = match[1];
      if (!allowlist.calendarPolicies.has(policy)) {
        push({
          code: 'unsupported-calendar-policy',
          token: policy,
          path,
          message: `Narrative states unsupported calendar policy ${policy}.`
        });
      }
    }
  }

  return violations;
}
