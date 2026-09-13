/**
 * Independent audit tables. These literals intentionally do not call the
 * production hour/dayun helpers that they validate.
 */
export const auditStems = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const auditBranches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

export const chineseToKoreanGanzhi: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해'
};

export function koreanGanzhi(value: string) {
  return [...value].map((character) => chineseToKoreanGanzhi[character] ?? character).join('');
}

// 子 is 23:00-00:59; every following branch spans the next two civil hours.
export const independentHourBranchByClockHour = [
  '자', '축', '축', '인', '인', '묘', '묘', '진', '진', '사', '사', '오',
  '오', '미', '미', '신', '신', '유', '유', '술', '술', '해', '해', '자'
] as const;

// 五鼠遁: 甲己甲子, 乙庚丙子, 丙辛戊子, 丁壬庚子, 戊癸壬子.
// Rows are day stems 甲..癸; columns are hour branches 子..亥.
export const independentHourStemTable = [
  ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계', '갑', '을'],
  ['병', '정', '무', '기', '경', '신', '임', '계', '갑', '을', '병', '정'],
  ['무', '기', '경', '신', '임', '계', '갑', '을', '병', '정', '무', '기'],
  ['경', '신', '임', '계', '갑', '을', '병', '정', '무', '기', '경', '신'],
  ['임', '계', '갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'],
  ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계', '갑', '을'],
  ['병', '정', '무', '기', '경', '신', '임', '계', '갑', '을', '병', '정'],
  ['무', '기', '경', '신', '임', '계', '갑', '을', '병', '정', '무', '기'],
  ['경', '신', '임', '계', '갑', '을', '병', '정', '무', '기', '경', '신'],
  ['임', '계', '갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']
] as const;

export const yangYearStems = new Set(['갑', '병', '무', '경', '임']);

export function independentDayunDirection(
  yearStem: string,
  gender: 'male' | 'female'
): 'forward' | 'reverse' {
  const yangYear = yangYearStems.has(yearStem);
  return (gender === 'male' && yangYear) || (gender === 'female' && !yangYear)
    ? 'forward'
    : 'reverse';
}

export const timeDayunTableSources = {
  hourBranch: 'Traditional twelve double-hour civil-clock mapping; cross-checked with 6tail lunar-javascript 1.7.7.',
  hourStem: '五鼠遁 table in 易學象數論/六壬透易 and 6tail lunar-javascript 1.7.7.',
  dayunDirection: '淵海子平 論起大運法 and 6tail lunar-javascript 1.7.7.',
  dayunConversion: '淵海子平: three days correspond to one year; exact calendar conversion remains provider-policy-sensitive.'
} as const;
