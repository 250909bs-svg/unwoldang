import type { IntakeFormData } from '../../api/mockData';
import { validateBirthInput } from '../../lib/birthInputValidation';
import { readReportArchiveEntries } from '../../lib/reportArchive';
import { GENERAL_SIGNATURE_DRAFT_KEY } from '../../products/general-signature/generalSignatureIntakeContract';
import type { GuiyeondoBirthProfile } from './types';

const KOREA_LOCATION = {
  label: '대한민국 · 표준시',
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  applySolarTimeCorrection: false
} as const;

function canUseKoreaFallback(location?: string) {
  const value = location?.trim().toLocaleLowerCase('ko-KR');
  return !value || ['대한민국 · 표준시', '대한민국', '한국', '서울', 'seoul', 'korea', 'south korea'].includes(value);
}

export function toGuiyeondoBirthProfile(
  source?: Partial<IntakeFormData> | null
): GuiyeondoBirthProfile | null {
  if (!source || (source.gender !== 'male' && source.gender !== 'female')) return null;
  if (source.calendar !== 'solar' && source.calendar !== 'lunar') return null;
  if (!source.name?.trim() || !source.birthDate) return null;
  if (source.birthTimePrecision === 'branch-range') return null;

  const isUnknownTime = Boolean(source.isUnknownTime || !source.birthTime);
  const dayBoundaryPolicy = source.dayBoundaryPolicy === 'late-zi' ? 'late-zi' : 'midnight';
  const birthLocation = source.birthLocation || (canUseKoreaFallback(source.location) ? KOREA_LOCATION : null);
  if (!birthLocation) return null;
  const candidate: Partial<IntakeFormData> = {
    ...source,
    isUnknownTime,
    birthTime: isUnknownTime ? '' : source.birthTime,
    birthTimePrecision: isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy,
    birthLocation,
    location: source.location?.trim() || birthLocation.label || KOREA_LOCATION.label
  };
  if (!validateBirthInput(candidate, { subjectLabel: source.name.trim() }).valid) return null;

  return {
    name: source.name.trim().slice(0, 20),
    gender: source.gender,
    calendar: source.calendar,
    isLeapMonth: source.calendar === 'lunar' && Boolean(source.isLeapMonth),
    birthDate: source.birthDate,
    birthTime: isUnknownTime ? '' : source.birthTime || '',
    isUnknownTime,
    birthTimePrecision: isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy,
    location: candidate.location || KOREA_LOCATION.label,
    birthLocation: candidate.birthLocation || KOREA_LOCATION
  };
}

export function recoverGuiyeondoOwnerProfile(ownerId?: string) {
  const archiveProfile = readReportArchiveEntries(ownerId)
    .filter((entry) => entry.productId === 'general-signature' && entry.formData)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((entry) => toGuiyeondoBirthProfile(entry.formData))
    .find((profile): profile is GuiyeondoBirthProfile => Boolean(profile));
  if (archiveProfile) return { profile: archiveProfile, source: 'archive' as const };

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(GENERAL_SIGNATURE_DRAFT_KEY);
    if (!raw) return null;
    const profile = toGuiyeondoBirthProfile(JSON.parse(raw) as Partial<IntakeFormData>);
    return profile ? { profile, source: 'recent-input' as const } : null;
  } catch {
    return null;
  }
}

export function isGuiyeondoProfileAtLeastAge(
  profile: GuiyeondoBirthProfile,
  minimumAge: number,
  now = new Date()
) {
  const validation = validateBirthInput(profile, { subjectLabel: profile.name });
  const trace = validation.calculation?.trace || validation.calculation?.scenarios[0]?.trace;
  if (!validation.valid || !trace) return false;

  const { year, month, day } = trace.normalizedSolarDate;
  const minimumBirthDate = new Date(Date.UTC(
    now.getUTCFullYear() - minimumAge,
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  return birthDate <= minimumBirthDate;
}

export function createKoreanBirthProfile(input: {
  name: string;
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  birthDate: string;
  birthTime: string;
  isUnknownTime: boolean;
  dayBoundaryPolicy?: 'midnight' | 'late-zi';
}) {
  return toGuiyeondoBirthProfile({
    ...input,
    birthTimePrecision: input.isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: input.dayBoundaryPolicy || 'midnight',
    location: KOREA_LOCATION.label,
    birthLocation: KOREA_LOCATION
  });
}
