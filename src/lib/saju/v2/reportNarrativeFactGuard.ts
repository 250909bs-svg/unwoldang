import type { DeterministicSajuBasis } from '../deterministicBasis';
import type { SajuReportData } from '../report';

export type NarrativeGanzhiRole =
  | 'year-pillar'
  | 'month-pillar'
  | 'day-pillar'
  | 'hour-pillar'
  | 'current-dayun'
  | 'next-dayun'
  | 'dayun'
  | 'seun'
  | 'year-ganzhi'
  | 'wolyun';

export type NarrativePillarRole =
  | 'year-pillar'
  | 'month-pillar'
  | 'day-pillar'
  | 'hour-pillar';

export interface NarrativeFactAllowlist {
  ganzhi: ReadonlySet<string>;
  ganzhiByRole: Readonly<Record<NarrativeGanzhiRole, ReadonlySet<string>>>;
  partnerGanzhiByRole: Readonly<Record<NarrativePillarRole, ReadonlySet<string>>>;
  partnerSubjectMarkers: ReadonlySet<string>;
  years: ReadonlySet<number>;
  dayMasters: ReadonlySet<string>;
  elementValues: ReadonlyMap<string, ReadonlySet<number>>;
  elementPercentages: ReadonlyMap<string, ReadonlySet<number>>;
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
const GANZHI_ROLE_LABEL = '현재\\s*대운|다음\\s*대운|년주|월주|일주|시주|대운|세운|월운|년';
const PILLAR_ROLE_LABEL = '년주|월주|일주|시주';
const GANZHI_TOKEN = `(?:[${STEMS}][${BRANCHES}]|[${HANJA_STEMS}][${HANJA_BRANCHES}])`;
const SELF_SUBJECT_MARKERS = [
  '나', '저', '본인', '당신', '고객', '고객님', '의뢰인', '의뢰인님', '사용자',
  '원국', '명식', '사주', '차트'
] as const;
const PARTNER_RELATIONSHIP_MARKERS = [
  '상대방', '상대', '파트너', '연인', '애인', '배우자',
  '남친', '여친', '남자친구', '여자친구', '그 사람'
] as const;
const SUBJECT_WORD = '[가-힣A-Za-z0-9._-]{1,30}(?:\\s*(?:님|씨))?';

interface SubjectGanzhiPattern {
  pattern: RegExp;
  subjectIndex: number;
  tokenIndex: number;
  roleIndex: number;
  kind: 'known' | 'possessive';
}
const GANZHI_PATTERNS = [
  {
    pattern: new RegExp(`([${STEMS}][${BRANCHES}])\\s*(${GANZHI_ROLE_LABEL})`, 'g'),
    tokenIndex: 1,
    roleIndex: 2
  },
  {
    pattern: new RegExp(`(${GANZHI_ROLE_LABEL})\\s*(?:은|는|이|가|:)?\\s*([${STEMS}][${BRANCHES}])`, 'g'),
    tokenIndex: 2,
    roleIndex: 1
  },
  {
    pattern: new RegExp(`([${HANJA_STEMS}][${HANJA_BRANCHES}])\\s*(${GANZHI_ROLE_LABEL})`, 'g'),
    tokenIndex: 1,
    roleIndex: 2
  },
  {
    pattern: new RegExp(`(${GANZHI_ROLE_LABEL})\\s*(?:은|는|이|가|:)?\\s*([${HANJA_STEMS}][${HANJA_BRANCHES}])`, 'g'),
    tokenIndex: 2,
    roleIndex: 1
  }
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
  `(\\uAC1C|%)`,
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

function narrativeRole(label: string): NarrativeGanzhiRole {
  const normalized = label.replace(/\s/g, '');
  if (normalized === '년주') return 'year-pillar';
  if (normalized === '월주') return 'month-pillar';
  if (normalized === '일주') return 'day-pillar';
  if (normalized === '년') return 'year-ganzhi';
  if (normalized === '시주') return 'hour-pillar';
  if (normalized === '현재대운') return 'current-dayun';
  if (normalized === '다음대운') return 'next-dayun';
  if (normalized === '대운') return 'dayun';
  if (normalized === '월운') return 'wolyun';
  return 'seun';
}

function createGanzhiByRole(): Record<NarrativeGanzhiRole, Set<string>> {
  return {
    'year-pillar': new Set<string>(),
    'month-pillar': new Set<string>(),
    'day-pillar': new Set<string>(),
    'hour-pillar': new Set<string>(),
    'current-dayun': new Set<string>(),
    'next-dayun': new Set<string>(),
    dayun: new Set<string>(),
    seun: new Set<string>(),
    'year-ganzhi': new Set<string>(),
    wolyun: new Set<string>()
  };
}

function createPartnerGanzhiByRole(): Record<NarrativePillarRole, Set<string>> {
  return {
    'year-pillar': new Set<string>(),
    'month-pillar': new Set<string>(),
    'day-pillar': new Set<string>(),
    'hour-pillar': new Set<string>()
  };
}

function normalizeSubjectMarker(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function addPartnerSubjectMarker(target: Set<string>, value: string | null | undefined) {
  const marker = value ? normalizeSubjectMarker(value) : '';
  if (!marker || marker.length > 40 || /[\r\n]/.test(marker)) return;
  target.add(marker);
  if (!marker.endsWith('님')) target.add(`${marker}님`);
  if (!marker.endsWith('씨')) {
    target.add(`${marker} 씨`);
    target.add(`${marker}씨`);
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function subjectMarkerPattern(markers: readonly string[]) {
  return [...markers]
    .sort((left, right) => right.length - left.length)
    .map((marker) => normalizeSubjectMarker(marker).split(' ').map(escapeRegex).join('\\s+'))
    .join('|');
}

function buildSubjectGanzhiPatterns(
  partnerSubjectMarkers: ReadonlySet<string>
): SubjectGanzhiPattern[] {
  const knownSubject = subjectMarkerPattern([
    ...SELF_SUBJECT_MARKERS,
    ...PARTNER_RELATIONSHIP_MARKERS,
    ...partnerSubjectMarkers
  ]);
  const knownPrefix = `(?<![가-힣A-Za-z0-9_])(${knownSubject})\\s*(?:의)?\\s*`;
  const possessivePrefix = `(?<![가-힣A-Za-z0-9_])(${SUBJECT_WORD})\\s*의\\s*`;
  const suffix = `\\s*(?:은|는|이|가|:)?\\s*(${GANZHI_TOKEN})`;

  return [
    {
      pattern: new RegExp(`${knownPrefix}(${PILLAR_ROLE_LABEL})${suffix}`, 'g'),
      subjectIndex: 1,
      roleIndex: 2,
      tokenIndex: 3,
      kind: 'known'
    },
    {
      pattern: new RegExp(`${knownPrefix}(${GANZHI_TOKEN})\\s*(${PILLAR_ROLE_LABEL})`, 'g'),
      subjectIndex: 1,
      tokenIndex: 2,
      roleIndex: 3,
      kind: 'known'
    },
    {
      pattern: new RegExp(
        `(${GANZHI_TOKEN})\\s*(?:은|는|이|가)?\\s*${knownPrefix}(${PILLAR_ROLE_LABEL})`,
        'g'
      ),
      tokenIndex: 1,
      subjectIndex: 2,
      roleIndex: 3,
      kind: 'known'
    },
    {
      pattern: new RegExp(`${possessivePrefix}(${PILLAR_ROLE_LABEL})${suffix}`, 'g'),
      subjectIndex: 1,
      roleIndex: 2,
      tokenIndex: 3,
      kind: 'possessive'
    },
    {
      pattern: new RegExp(`${possessivePrefix}(${GANZHI_TOKEN})\\s*(${PILLAR_ROLE_LABEL})`, 'g'),
      subjectIndex: 1,
      tokenIndex: 2,
      roleIndex: 3,
      kind: 'possessive'
    },
    {
      pattern: new RegExp(
        `(${GANZHI_TOKEN})\\s*(?:은|는|이|가)?\\s*${possessivePrefix}(${PILLAR_ROLE_LABEL})`,
        'g'
      ),
      tokenIndex: 1,
      subjectIndex: 2,
      roleIndex: 3,
      kind: 'possessive'
    }
  ];
}

function addGanzhi(target: Set<string>, value: string | null | undefined) {
  const token = value?.trim();
  if (token && token.length === 2 && STEMS.includes(token[0]) && BRANCHES.includes(token[1])) {
    target.add(token);
  }
}

function addRoleGanzhi(
  all: Set<string>,
  byRole: Record<NarrativeGanzhiRole, Set<string>>,
  role: NarrativeGanzhiRole,
  value: string | null | undefined
) {
  const token = value?.trim();
  if (!token || token.length !== 2 || !STEMS.includes(token[0]) || !BRANCHES.includes(token[1])) {
    return;
  }
  addGanzhi(all, token);
  byRole[role].add(token);
  if (role === 'year-pillar' || role === 'seun') {
    byRole['year-ganzhi'].add(token);
  }
  if (role === 'current-dayun' || role === 'next-dayun') {
    byRole.dayun.add(token);
  }
}

function addPartnerRoleGanzhi(
  all: Set<string>,
  byRole: Record<NarrativePillarRole, Set<string>>,
  role: NarrativePillarRole,
  value: string | null | undefined
) {
  const token = value?.trim();
  if (!token || token.length !== 2 || !STEMS.includes(token[0]) || !BRANCHES.includes(token[1])) {
    return;
  }
  addGanzhi(all, token);
  byRole[role].add(token);
}

function addRoleGanzhiFromText(
  all: Set<string>,
  byRole: Record<NarrativeGanzhiRole, Set<string>>,
  role: NarrativeGanzhiRole,
  value: string | null | undefined
) {
  if (!value) return;
  for (const match of value.matchAll(new RegExp(`[${STEMS}][${BRANCHES}]`, 'g'))) {
    addRoleGanzhi(all, byRole, role, match[0]);
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

function addElementDistribution(
  valuesTarget: Map<string, Set<number>>,
  percentagesTarget: Map<string, Set<number>>,
  distribution: ReadonlyArray<{ label: string; value: number }>
) {
  const total = distribution.reduce(
    (sum, item) => Number.isFinite(item.value) ? sum + item.value : sum,
    0
  );
  distribution.forEach(({ label, value }) => {
    addElementValue(valuesTarget, label, value);
    if (!ELEMENTS.includes(label) || !Number.isFinite(value) || total <= 0) return;
    const percentages = percentagesTarget.get(label) || new Set<number>();
    percentages.add(Math.round((value / total) * 100));
    percentagesTarget.set(label, percentages);
  });
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
  target.add(Math.floor(value));
}

/** Builds an allowlist only from trusted structured fields, never customer questions/free text. */
export function buildNarrativeFactAllowlist(
  base: SajuReportData,
  basis?: DeterministicSajuBasis
): NarrativeFactAllowlist {
  const ganzhi = new Set<string>();
  const ganzhiByRole = createGanzhiByRole();
  const partnerGanzhiByRole = createPartnerGanzhiByRole();
  const partnerSubjectMarkers = new Set<string>();
  const years = new Set<number>();
  const dayMasters = new Set<string>();
  const elementValues = new Map<string, Set<number>>();
  const elementPercentages = new Map<string, Set<number>>();
  const helpfulElements = new Set<string>();
  const strengthLabels = new Set<string>();
  const dayunStartAges = new Set<number>();
  const calendarPolicies = new Set<string>();

  addRoleGanzhi(ganzhi, ganzhiByRole, 'year-pillar', base.pillars.year);
  addRoleGanzhi(ganzhi, ganzhiByRole, 'month-pillar', base.pillars.month);
  addRoleGanzhi(ganzhi, ganzhiByRole, 'day-pillar', base.pillars.day);
  addRoleGanzhi(ganzhi, ganzhiByRole, 'hour-pillar', base.pillars.hour);
  addRoleGanzhiFromText(ganzhi, ganzhiByRole, 'current-dayun', base.currentDayun.name);
  addRoleGanzhiFromText(ganzhi, ganzhiByRole, 'current-dayun', base.currentDayun.summary);
  addRoleGanzhiFromText(ganzhi, ganzhiByRole, 'next-dayun', base.nextDayun.name);
  addRoleGanzhiFromText(ganzhi, ganzhiByRole, 'next-dayun', base.nextDayun.summary);
  base.yearLuck.forEach((item) => {
    addRoleGanzhi(ganzhi, ganzhiByRole, 'seun', item.ganzhi);
    years.add(item.year);
  });
  base.monthLuck.forEach((item) => {
    addRoleGanzhi(ganzhi, ganzhiByRole, 'wolyun', item.ganzhi);
    years.add(item.year);
  });
  addYearsFromText(years, base.currentDayun.range);
  addYearsFromText(years, base.nextDayun.range);
  if (STEMS.includes(base.dayMaster)) dayMasters.add(base.dayMaster);
  addElementDistribution(elementValues, elementPercentages, base.fiveElements);
  base.helpfulElements.forEach((element) => helpfulElements.add(element));
  addStrengthLabel(strengthLabels, base.strengthLabel);

  if (basis) {
    addRoleGanzhi(ganzhi, ganzhiByRole, 'year-pillar', basis.pillars.year);
    addRoleGanzhi(ganzhi, ganzhiByRole, 'month-pillar', basis.pillars.month);
    addRoleGanzhi(ganzhi, ganzhiByRole, 'day-pillar', basis.pillars.day);
    addRoleGanzhi(ganzhi, ganzhiByRole, 'hour-pillar', basis.pillars.hour);
    basis.dayun.forEach((item) => {
      addRoleGanzhi(ganzhi, ganzhiByRole, 'dayun', item.ganzhi);
      years.add(item.year);
    });
    addDayunStartAge(dayunStartAges, basis.dayun[0]?.startAgeExact);
    basis.seun.forEach((item) => {
      addRoleGanzhi(ganzhi, ganzhiByRole, 'seun', item.ganzhi);
      years.add(item.year);
    });
    addRoleGanzhi(
      ganzhi,
      ganzhiByRole,
      'current-dayun',
      basis.commercialV2.luckContext.currentDayun?.ganzhi
    );
    addRoleGanzhi(
      ganzhi,
      ganzhiByRole,
      'next-dayun',
      basis.commercialV2.luckContext.nextDayun?.ganzhi
    );
    addRoleGanzhi(ganzhi, ganzhiByRole, 'seun', basis.commercialV2.luckContext.currentSeun.ganzhi);
    addRoleGanzhi(ganzhi, ganzhiByRole, 'wolyun', basis.commercialV2.luckContext.currentWolyun.ganzhi);
    basis.commercialV2.calendar.scenarioPillars.forEach((scenario) => {
      addRoleGanzhi(ganzhi, ganzhiByRole, 'year-pillar', scenario.year);
      addRoleGanzhi(ganzhi, ganzhiByRole, 'month-pillar', scenario.month);
      addRoleGanzhi(ganzhi, ganzhiByRole, 'day-pillar', scenario.day);
      addRoleGanzhi(ganzhi, ganzhiByRole, 'hour-pillar', scenario.hour);
    });
    addPartnerSubjectMarker(partnerSubjectMarkers, basis.commercialV2.partner?.name);
    basis.commercialV2.partner?.calendar.scenarioPillars.forEach((scenario) => {
      addPartnerRoleGanzhi(ganzhi, partnerGanzhiByRole, 'year-pillar', scenario.year);
      addPartnerRoleGanzhi(ganzhi, partnerGanzhiByRole, 'month-pillar', scenario.month);
      addPartnerRoleGanzhi(ganzhi, partnerGanzhiByRole, 'day-pillar', scenario.day);
      addPartnerRoleGanzhi(ganzhi, partnerGanzhiByRole, 'hour-pillar', scenario.hour);
    });
    const birthYear = Number(basis.input.birthDate.slice(0, 4));
    if (Number.isInteger(birthYear)) years.add(birthYear);
    years.add(basis.commercialV2.generatedFor.year);
    dayMasters.add(basis.dayMaster.stem);
    addElementDistribution(elementValues, elementPercentages, basis.fiveElements);
    basis.helpfulElements.forEach((element) => helpfulElements.add(element));
    addStrengthLabel(strengthLabels, basis.strength.label);
    calendarPolicies.add(basis.input.dayBoundaryPolicy);
    calendarPolicies.add(basis.commercialV2.calendar.dayBoundaryPolicy);
  }

  return {
    ganzhi,
    ganzhiByRole,
    partnerGanzhiByRole,
    partnerSubjectMarkers,
    years,
    dayMasters,
    elementValues,
    elementPercentages,
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

  const subjectGanzhiPatterns = buildSubjectGanzhiPatterns(allowlist.partnerSubjectMarkers);
  const selfSubjectMarkers = new Set<string>(SELF_SUBJECT_MARKERS);

  for (const { path, text } of narrativeStrings(narrative)) {
    const subjectMatchRanges: Array<{ start: number; end: number }> = [];
    for (const { pattern, subjectIndex, tokenIndex, roleIndex, kind } of subjectGanzhiPatterns) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        if (subjectMatchRanges.some((range) => start < range.end && end > range.start)) {
          continue;
        }
        subjectMatchRanges.push({ start, end });
        const subjectMarker = normalizeSubjectMarker(match[subjectIndex]);
        const subject = kind === 'known' && selfSubjectMarkers.has(subjectMarker)
          ? 'self'
          : 'partner';
        const token = normalizeGanzhiToken(match[tokenIndex]);
        const role = narrativeRole(match[roleIndex]) as NarrativePillarRole;
        const supported = subject === 'self'
          ? allowlist.ganzhiByRole[role].has(token)
          : allowlist.partnerGanzhiByRole[role].has(token);
        if (!supported) {
          push({
            code: 'unsupported-ganzhi',
            token,
            path,
            message: `제공되지 않은 ${subject} ${role} 간지 ${token}를 계산 사실처럼 서술했습니다.`
          });
        }
      }
    }

    for (const { pattern, tokenIndex, roleIndex } of GANZHI_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        if (subjectMatchRanges.some((range) => start < range.end && end > range.start)) {
          continue;
        }
        const token = normalizeGanzhiToken(match[tokenIndex]);
        const role = narrativeRole(match[roleIndex]);
        if (!allowlist.ganzhiByRole[role].has(token)) {
          push({
            code: 'unsupported-ganzhi',
            token,
            path,
            message: `제공되지 않은 ${role} 간지 ${token}를 계산 사실처럼 서술했습니다.`
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
      const unit = match[3];
      const supported = unit === '%'
        ? allowlist.elementPercentages.get(element)?.has(value)
        : allowlist.elementValues.get(element)?.has(value);
      if (!supported) {
        push({
          code: 'unsupported-element-value',
          token: `${element}:${value}${unit}`,
          path,
          message: `Narrative states an unsupported ${element} element value (${value}${unit}).`
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
