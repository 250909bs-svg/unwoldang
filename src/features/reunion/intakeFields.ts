/**
 * 재회운 입력창의 순수 필드 변환기.
 *
 * 왜 분리했나
 * -----------
 * 입력창이 네이티브 `<input type="date">` / `<input type="time">` 를 버렸다.
 * 이유는 미관이 아니라 두 가지다.
 *   1) 네이티브 피커는 OS 서체·OS 색으로 그려지므로 이 화면의 서체 위계와
 *      금속 팔레트를 통째로 무시한다. 한 화면에 OS 위젯이 두 개 뜨는 순간
 *      나머지 고급화가 전부 상쇄된다.
 *   2) 값의 표기(1995.10.15)와 저장형(1995-10-15)이 분리되어야 한다.
 *      드래프트는 `reunionFlow.ts` 의 계약대로 항상 ISO 를 들고 있어야 하고,
 *      사용자는 여덟 자리 숫자만 두드리면 된다.
 *
 * 그래서 화면 상태(여덟 자리 버퍼 · 오전/오후 · 시 · 분)와 드래프트 값(ISO 날짜 ·
 * HH:mm)의 변환을 이 파일이 전부 맡는다. 컴포넌트에는 분기가 남지 않는다.
 * 여기 있는 함수는 전부 순수 함수이므로 단위 테스트가 브라우저 없이 돈다.
 */

export type ClockPeriod = '' | 'am' | 'pm';

export type ClockDraft = {
  period: ClockPeriod;
  hour: string;
  minute: string;
};

export const EMPTY_CLOCK: ClockDraft = { period: '', hour: '', minute: '' };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXACT_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const EARLIEST_BIRTH_YEAR = 1900;

/** 숫자만 남기고 여덟 자리로 자른다. IME 가 섞어 넣는 문자를 그대로 흘리지 않는다. */
export function birthDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

/** 화면 표기. 1995 → 1995 / 199510 → 1995.10 / 19951015 → 1995.10.15 */
export function displayBirthDigits(value: string) {
  const digits = birthDigits(value);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

/** 여덟 자리가 실제 달력 날짜일 때만 true. 음력은 30일까지만 허용한다. */
export function isBirthDigitsReady(value: string, calendar: 'solar' | 'lunar' = 'solar') {
  const digits = birthDigits(value);
  if (digits.length !== 8) return false;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (year < EARLIEST_BIRTH_YEAR || year > new Date().getFullYear()) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  if (calendar === 'lunar') return day <= 30;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** 드래프트에 넣을 ISO 날짜. 아직 완성되지 않았으면 빈 문자열이다. */
export function toIsoBirthDate(value: string, calendar: 'solar' | 'lunar' = 'solar') {
  const digits = birthDigits(value);
  if (!isBirthDigitsReady(digits, calendar)) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** ISO 날짜를 여덟 자리 버퍼로 되돌린다(저장된 드래프트 복원용). */
export function fromIsoBirthDate(value: string) {
  const match = ISO_DATE.exec(value.trim());
  return match ? `${match[1]}${match[2]}${match[3]}` : '';
}

/** 오늘보다 미래인 여덟 자리를 막는다. 마지막 연락일에 쓴다. */
export function isNotFuture(value: string) {
  const iso = toIsoBirthDate(value);
  if (!iso) return false;
  return iso <= new Date().toISOString().slice(0, 10);
}

/** 'HH:mm' 24시 표기를 오전/오후 + 12시 표기로 쪼갠다. */
export function parseClock(value: string): ClockDraft {
  if (!EXACT_TIME.test(value)) return EMPTY_CLOCK;

  const [hourText, minute] = value.split(':');
  const hour24 = Number(hourText);

  return {
    period: hour24 >= 12 ? 'pm' : 'am',
    hour: String(hour24 % 12 || 12),
    minute
  };
}

/** 오전/오후 + 12시 표기를 'HH:mm' 으로 합친다. 하나라도 비면 빈 문자열이다. */
export function toClockValue({ period, hour, minute }: ClockDraft) {
  if (!period || !hour || !minute) return '';

  const hour12 = Number(hour);
  const minutes = Number(minute);
  if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12) return '';
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return '';

  const hour24 = (hour12 % 12) + (period === 'pm' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** 시 · 분 칸에 들어갈 숫자만 두 자리로 자른다. */
export function clockDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 2);
}

/**
 * 두 사람 원장(ledger)에 적을 한 줄 요약.
 * 값이 없으면 자리표시 '—' 를 돌려준다 — 없는 값을 있는 것처럼 채우지 않는다.
 */
export function ledgerSummary(input: {
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  birthDate: string;
  birthTime: string;
  isUnknownTime: boolean;
}) {
  const digits = fromIsoBirthDate(input.birthDate);
  if (!digits) return '—';

  const calendarLabel = input.calendar === 'lunar' ? (input.isLeapMonth ? '윤달' : '음력') : '양력';
  const date = displayBirthDigits(digits);
  const time = input.isUnknownTime ? '시간 모름' : input.birthTime;

  return time ? `${calendarLabel} ${date} · ${time}` : `${calendarLabel} ${date}`;
}
