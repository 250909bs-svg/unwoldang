import type { CivilDateTime } from './types';

export type LocalDateTimeStatus = 'valid-unique' | 'nonexistent' | 'ambiguous';

export interface LocalDateTimeCandidate {
  instant: Date;
  utcOffsetMinutes: number;
}

export interface LocalDateTimeResolution {
  status: LocalDateTimeStatus;
  candidates: LocalDateTimeCandidate[];
}

export type LocalTimeValidationErrorCode =
  | 'invalid-timezone'
  | 'nonexistent-local-time'
  | 'ambiguous-local-time'
  | 'utc-offset-mismatch';

export class LocalTimeValidationError extends Error {
  constructor(
    readonly code: LocalTimeValidationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'LocalTimeValidationError';
  }
}

type ZonedParts = CivilDateTime & { second: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const OFFSET_PROBE_WINDOW_HOURS = 48;
const OFFSET_PROBE_STEP_HOURS = 3;

function getFormatter(timeZone: string) {
  const existing = formatterCache.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  // Formatting forces Intl to resolve the identifier instead of merely storing it.
  formatter.format(new Date(0));
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function assertValidIanaTimeZone(timeZone: string) {
  const normalized = timeZone.trim();
  if (!normalized || (normalized !== 'UTC' && !normalized.includes('/'))) {
    throw new LocalTimeValidationError(
      'invalid-timezone',
      `유효하지 않은 IANA 시간대입니다: ${timeZone}`
    );
  }

  try {
    getFormatter(normalized);
  } catch {
    throw new LocalTimeValidationError(
      'invalid-timezone',
      `유효하지 않은 IANA 시간대입니다: ${timeZone}`
    );
  }
}

function readZonedParts(formatter: Intl.DateTimeFormat, instant: Date): ZonedParts {
  const parts = formatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second')
  };
}

function sameLocalMinute(left: CivilDateTime, right: ZonedParts) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

function offsetMillisecondsAt(formatter: Intl.DateTimeFormat, instantMs: number) {
  const wholeSecondMs = Math.trunc(instantMs / 1000) * 1000;
  const rendered = readZonedParts(formatter, new Date(wholeSecondMs));
  return Date.UTC(
    rendered.year,
    rendered.month - 1,
    rendered.day,
    rendered.hour,
    rendered.minute,
    rendered.second
  ) - wholeSecondMs;
}

function collectCandidateOffsets(
  formatter: Intl.DateTimeFormat,
  localEpochMs: number,
  explicitOffsetMinutes?: number
) {
  const offsets = new Set<number>();
  if (explicitOffsetMinutes !== undefined && Number.isFinite(explicitOffsetMinutes)) {
    offsets.add(explicitOffsetMinutes * 60_000);
  }

  // Probe both sides of any nearby transition. Month probes also cover the zone's
  // other seasonal offset without embedding a country-specific DST calendar.
  for (
    let hourDelta = -OFFSET_PROBE_WINDOW_HOURS;
    hourDelta <= OFFSET_PROBE_WINDOW_HOURS;
    hourDelta += OFFSET_PROBE_STEP_HOURS
  ) {
    offsets.add(offsetMillisecondsAt(formatter, localEpochMs + hourDelta * 3_600_000));
  }

  const localYear = new Date(localEpochMs).getUTCFullYear();
  for (const year of [localYear - 1, localYear, localYear + 1]) {
    for (let month = 0; month < 12; month += 1) {
      offsets.add(offsetMillisecondsAt(formatter, Date.UTC(year, month, 15, 12)));
    }
  }

  return offsets;
}

/**
 * Resolves a wall-clock minute by IANA round-trip. No offset is selected here:
 * zero candidates is a DST gap, while multiple candidates is a DST fold.
 */
export function resolveLocalDateTime(
  localDateTime: CivilDateTime,
  timeZone: string,
  explicitOffsetMinutes?: number
): LocalDateTimeResolution {
  assertValidIanaTimeZone(timeZone);
  const formatter = getFormatter(timeZone.trim());
  const localEpochMs = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute
  );
  const candidates = [...collectCandidateOffsets(formatter, localEpochMs, explicitOffsetMinutes)]
    .map((offsetMs) => ({
      instant: new Date(localEpochMs - offsetMs),
      utcOffsetMinutes: offsetMs / 60_000
    }))
    .filter((candidate) => sameLocalMinute(
      localDateTime,
      readZonedParts(formatter, candidate.instant)
    ))
    .filter((candidate, index, values) =>
      values.findIndex((value) => value.instant.getTime() === candidate.instant.getTime()) === index
    )
    .sort((left, right) => left.instant.getTime() - right.instant.getTime());

  return {
    status: candidates.length === 0
      ? 'nonexistent'
      : candidates.length === 1
        ? 'valid-unique'
        : 'ambiguous',
    candidates
  };
}

/**
 * Enforces that an exact birth clock maps to one physical instant. Ambiguous
 * clocks are allowed only when the caller supplies one of the observed offsets.
 */
export function assertResolvableLocalDateTime(
  localDateTime: CivilDateTime,
  timeZone: string,
  explicitOffsetMinutes?: number
) {
  const resolution = resolveLocalDateTime(localDateTime, timeZone, explicitOffsetMinutes);

  if (resolution.status === 'nonexistent') {
    throw new LocalTimeValidationError(
      'nonexistent-local-time',
      '선택한 지역에서는 해당 시간이 존재하지 않습니다. 출생시간을 다시 확인해 주세요.'
    );
  }

  if (resolution.status === 'ambiguous' && explicitOffsetMinutes === undefined) {
    throw new LocalTimeValidationError(
      'ambiguous-local-time',
      '이 시간은 서머타임 전환으로 두 번 존재합니다. 출생 당시의 정확한 UTC 오프셋을 확인해 주세요.'
    );
  }

  const selected = explicitOffsetMinutes === undefined
    ? resolution.candidates[0]
    : resolution.candidates.find((candidate) =>
        Math.abs(candidate.utcOffsetMinutes - explicitOffsetMinutes) < 1e-9
      );

  if (!selected) {
    throw new LocalTimeValidationError(
      'utc-offset-mismatch',
      '입력한 UTC 오프셋이 해당 지역의 출생 시각과 일치하지 않습니다. 시간대 정보를 다시 확인해 주세요.'
    );
  }

  return { resolution, selected };
}
