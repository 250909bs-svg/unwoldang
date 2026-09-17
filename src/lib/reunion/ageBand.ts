/**
 * 재회운 리포트 · 연령대 밴드 (명세 §2-2).
 *
 * 규칙:
 * - 이 파일의 모든 함수는 순수하다. `new Date()` 를 부르지 않는다.
 *   기준 시각은 반드시 호출자가 넘긴다(리포트의 `createdAt` 또는 basis 의 `generatedFor.instant`).
 *   뷰에서 현재 시각을 읽으면 같은 입력이 날짜마다 다른 리포트를 낳아 재현성 검증과 어긋난다.
 * - 판정 실패·미입력은 전부 'neutral' 로 착지한다. 'late20s' 를 기본값으로 쓰지 않는다.
 * - 밴드는 어휘·강조만 바꾸고, 나이나 세대를 화면 문장에 쓰지 않는다(§2-4, §6-E).
 */

export const REUNION_AGE_BANDS = [
  'teen',
  'early20s',
  'late20s',
  'thirties',
  'forties',
  'fiftyPlus',
  'neutral'
] as const;

export type ReunionAgeBand = (typeof REUNION_AGE_BANDS)[number];

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})/u;
const KO_DATE = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/u;

function isRealDate(parts: CalendarDateParts) {
  const { year, month, day } = parts;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/**
 * `1994-03-12` / `1994년 3월 12일` / ISO 인스턴트 문자열을 달력 3요소로 읽는다.
 * ISO 인스턴트는 UTC 기준이 아니라 KST(+09:00) 기준 달력 날짜로 환산한다 —
 * 기준 시각이 자정 근처일 때 하루가 밀려 밴드 경계가 흔들리는 것을 막는다.
 */
export function parseCalendarDate(value: string | null | undefined): CalendarDateParts | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes('T')) {
    const instant = new Date(trimmed);
    if (Number.isNaN(instant.getTime())) return null;
    const kst = new Date(instant.getTime() + 9 * 60 * 60 * 1000);
    return {
      year: kst.getUTCFullYear(),
      month: kst.getUTCMonth() + 1,
      day: kst.getUTCDate()
    };
  }

  const match = ISO_DATE.exec(trimmed) || KO_DATE.exec(trimmed);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isRealDate(parts) ? parts : null;
}

/** 만 나이. 생일이 아직 지나지 않았으면 한 살 뺀다. */
export function ageYearsAt(birth: CalendarDateParts, at: CalendarDateParts): number {
  let age = at.year - birth.year;
  if (at.month < birth.month || (at.month === birth.month && at.day < birth.day)) age -= 1;
  return age;
}

export function toAgeBand(age: number | null): ReunionAgeBand {
  if (age === null || !Number.isFinite(age) || age < 10 || age > 120) return 'neutral';
  if (age <= 19) return 'teen';
  if (age <= 24) return 'early20s';
  if (age <= 29) return 'late20s';
  if (age <= 39) return 'thirties';
  if (age <= 49) return 'forties';
  return 'fiftyPlus';
}

export interface ReunionReaderAge {
  /** 만 나이. 파싱 실패·미입력이면 null. 화면에 절대 출력하지 않는다. */
  ageYears: number | null;
  ageBand: ReunionAgeBand;
}

/**
 * 생년월일 + 기준 시각 → 밴드.
 *
 * `birthDate` 는 정규화된 **양력** 날짜여야 한다. 음력 입력을 그대로 넘기면 최대 한 달까지
 * 어긋나 경계 나이(19/24/29/39/49)에서 밴드가 한 칸 튈 수 있다.
 * `referenceInstant` 는 리포트의 `createdAt` 또는 basis 의 `commercialV2.generatedFor.instant`.
 */
export function resolveReunionAgeBand(input: {
  birthDate?: string | null;
  referenceInstant?: string | null;
}): ReunionReaderAge {
  const birth = parseCalendarDate(input.birthDate);
  const at = parseCalendarDate(input.referenceInstant);
  if (!birth || !at) return { ageYears: null, ageBand: 'neutral' };

  const ageYears = ageYearsAt(birth, at);
  if (!Number.isFinite(ageYears) || ageYears < 0 || ageYears > 130) {
    return { ageYears: null, ageBand: 'neutral' };
  }
  return { ageYears, ageBand: toAgeBand(ageYears) };
}

/**
 * `현재 대운` 표기에서 나이를 지우고 연도로 바꾼다 (§2-4).
 *
 * **생년 + 시작 나이로 되짚지 않는다.** 입운은 정수 나이가 아니라 절기 기준 시각에서
 * 시작하므로(`baziCalcs.ts` 의 `dayun_start_iso`), `생년 + 30` 은 실제 시작 연도보다
 * 한 해 이르고 종료 연도는 두 해까지 어긋난다. 엔진이 계산한 경계
 * (`FortuneWindow.startsAt`/`endsAt`)에서 연도만 뽑아 쓰는 것이 유일하게 맞는 방법이다.
 *
 * 경계가 없으면 연도를 지어내지 않고 `null` 을 돌려준다 —
 * 계산되지 않은 구간에 ◆(계산값) 표시를 붙이는 것보다 값을 비우는 쪽이 정확하다.
 */
export function toDayunYearRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
): string | null {
  const start = parseCalendarDate(startsAt);
  const end = parseCalendarDate(endsAt);
  if (!start || !end || end.year < start.year) return null;
  return `${start.year} ~ ${end.year}`;
}

/** 나이 표기가 남아 있는지 검사한다. 밴드 금지 규칙(나이·세대 언급 일체)의 마지막 그물. */
export function containsAgeNotation(value: string): boolean {
  return /\d{1,3}\s*세(?![기대])/u.test(value);
}
