import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  IntakeFormData,
  LoveFocus,
  LoveInterest,
  LoveReaction,
  RelationshipStatus
} from '../api/mockData';
import { useAuth } from '../context/AuthContext';
import { validateBirthInput } from '../lib/birthInputValidation';
import { MZ_LOVE_CHOICE_STORAGE_KEY, normalizeLoveReaction } from '../lib/mz-love-fact/microChoice';
import {
  LOVE_READING_RELATIONSHIP_STATUSES,
  isLoveReadingDurationRequired,
  validateLoveReadingIntakeContext
} from '../products/love-reading/intakeContract';
import { getLoveReactionProfile, LOVE_REACTION_PROFILES } from '../products/love-reading/reactionProfiles';
import '../styles/mz-love-intake.css';

type IntakeLocationState = {
  formData?: Partial<IntakeFormData>;
  loveReaction?: unknown;
  tabOrigin?: string;
  draftOwnerId?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

type LoveIntakeDraft = Omit<IntakeFormData, 'gender' | 'interestedIn' | 'loveFocus' | 'loveReaction'> & {
  gender: '' | IntakeFormData['gender'];
  interestedIn: '' | LoveInterest;
  loveReaction: '' | LoveReaction;
  loveFocus: '' | LoveFocus;
};

type IntakeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type BirthPeriod = '' | 'am' | 'pm';

const DRAFT_KEY_PREFIX = 'unwoldang.love-intake.v3';
const GUEST_DRAFT_KEY = `${DRAFT_KEY_PREFIX}.guest`;
const BACKGROUND_VIDEO = '/media/mz-love-intake-background.mp4';
const BACKGROUND_POSTER = '/images/mz-love-fact/generated/room-corridor.webp';

const LOVE_FOCUS_OPTIONS: ReadonlyArray<{ value: LoveFocus; label: string; detail: string }> = [
  { value: 'partner-type', label: '내게 맞는 사람의 특징', detail: '오래 갈 사람의 성향과 관계 방식' },
  { value: 'next-love-timing', label: '다음 연애를 하는 시기', detail: '인연이 움직이는 흐름과 타이밍' },
  { value: 'my-attraction', label: '이성들이 보는 내 진짜 매력', detail: '끌림을 만드는 포인트와 첫인상' },
  { value: 'repeated-pattern', label: '내가 반복하는 사랑의 패턴', detail: '매번 비슷하게 꼬이는 이유와 전환점' }
];

const RELATIONSHIP_OPTIONS: ReadonlyArray<{
  value: Exclude<RelationshipStatus, ''>;
  label: string;
  detail: string;
}> = [
  { value: 'single', label: '지금 혼자예요', detail: '새 인연과 다음 연애가 궁금해요' },
  { value: 'situationship', label: '고민되는 사람은 있어요', detail: '썸인지 아닌지, 속마음이 궁금해요' },
  { value: 'ambiguous', label: '관계가 애매해요', detail: '우리 관계의 기준과 방향을 점검하고 싶어요' },
  { value: 'breakup-reunion', label: '헤어진 지 얼마 안 됐어요', detail: '재회와 정리 사이에서 고민 중이에요' },
  { value: 'dating', label: '애인이 있어요', detail: '지금 관계의 방향과 미래가 궁금해요' },
  { value: 'married', label: '결혼했어요', detail: '배우자와의 관계 패턴을 살펴보고 싶어요' }
];

const RELATIONSHIP_DURATION_OPTIONS: ReadonlyArray<{
  value: Exclude<IntakeFormData['relationshipDuration'], ''>;
  label: string;
}> = [
  { value: 'under1', label: '1년 미만' },
  { value: 'under3', label: '1–3년' },
  { value: 'under5', label: '3–5년' },
  { value: 'under10', label: '5–10년' }
];

const STEP_META: Record<IntakeStep, { title: string; guide: string }> = {
  1: {
    title: '생년월일을 말해줘',
    guide: '네 연애의 시작점을 계산하는 첫 번째 단서야.'
  },
  2: {
    title: '태어난 시간은?',
    guide: '정확한 시간을 알면 관계의 속도와 시기까지 더 촘촘하게 볼 수 있어.'
  },
  3: {
    title: '성별은?',
    guide: '대운의 방향과 관계 흐름을 계산할 때 반영할게.'
  },
  4: {
    title: '이름이 뭐야?',
    guide: '이제부터는 네 이름을 부르면서 이야기해 줄게.'
  },
  5: {
    title: '지금 마음에 걸리는 사람 있어?',
    guide: '현재 관계에 맞춰 같은 사주도 다르게 풀어야 하거든. 연애·결혼 중이면 기간도 골라줘.'
  },
  6: {
    title: '연락이 늦어질 때 넌 어때?',
    guide: '가장 먼저 나오는 반응을 골라줘. 원국과 함께 반복 패턴의 단서로 볼게.'
  },
  7: {
    title: '가장 알고 싶은 게 뭐야?',
    guide: '하나만 골라. 미리보기부터 이 주제를 중심으로 짚어줄게.'
  },
  8: {
    title: '딱 두 가지만 더 물을게',
    guide: '지금 가장 현실적인 고민을 적어줘. 네 원국과 함께 읽어볼게.'
  }
};

const EMPTY_DRAFT: LoveIntakeDraft = {
  name: '',
  gender: '',
  interestedIn: '',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: '',
  relationshipDuration: '',
  loveReaction: '',
  loveFocus: '',
  location: '',
  q1: '',
  q2: ''
};

function isLoveFocus(value: unknown): value is LoveFocus {
  return LOVE_FOCUS_OPTIONS.some((option) => option.value === value);
}

function isLoveInterest(value: unknown): value is LoveInterest {
  return value === 'men' || value === 'women' || value === 'any' ||
    value === 'prefer-not-to-say';
}

function isRelationshipStatus(value: unknown): value is Exclude<RelationshipStatus, ''> {
  return typeof value === 'string' && LOVE_READING_RELATIONSHIP_STATUSES.some((status) => status === value);
}

function readStoredLoveReaction(): LoveReaction | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(MZ_LOVE_CHOICE_STORAGE_KEY);
    const normalized = normalizeLoveReaction(stored);

    if (normalized && normalized !== stored) {
      window.sessionStorage.setItem(MZ_LOVE_CHOICE_STORAGE_KEY, normalized);
    }

    return normalized;
  } catch {
    return null;
  }
}

function readStoredDraft(draftKey: string | null): Partial<IntakeFormData> | null {
  if (typeof window === 'undefined' || !draftKey) return null;

  const raw = window.sessionStorage.getItem(draftKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<IntakeFormData>;
  } catch {
    window.sessionStorage.removeItem(draftKey);
    return null;
  }
}

function hydrateDraft(
  source?: Partial<IntakeFormData> | null,
  locationReaction?: unknown,
  storedReaction?: unknown
): LoveIntakeDraft {
  const gender = source?.gender === 'male' || source?.gender === 'female' ? source.gender : '';
  const relationshipStatus = isRelationshipStatus(source?.relationshipStatus) ? source.relationshipStatus : '';
  const reactionProfile = getLoveReactionProfile(locationReaction)
    ?? getLoveReactionProfile(source?.loveReaction)
    ?? getLoveReactionProfile(storedReaction);

  return {
    ...EMPTY_DRAFT,
    ...source,
    name: source?.name ?? '',
    gender,
    interestedIn: isLoveInterest(source?.interestedIn) ? source.interestedIn : '',
    calendar: source?.calendar === 'lunar' ? 'lunar' : 'solar',
    isLeapMonth: source?.calendar === 'lunar' && Boolean(source?.isLeapMonth),
    birthDate: source?.birthDate ?? '',
    birthTime: source?.birthTime ?? '',
    isUnknownTime: Boolean(source?.isUnknownTime),
    birthTimePrecision: source?.isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: source?.dayBoundaryPolicy || 'midnight',
    relationshipStatus,
    relationshipDuration: isLoveReadingDurationRequired(relationshipStatus) ? source?.relationshipDuration ?? '' : '',
    loveReaction: reactionProfile?.id ?? '',
    loveFocus: isLoveFocus(source?.loveFocus) ? source.loveFocus : '',
    location: source?.location ?? '',
    q1: source?.q1 ?? '',
    q2: source?.q2 ?? ''
  };
}

function sanitizeBirthDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

function displayBirthDate(value: string) {
  const digits = sanitizeBirthDigits(value);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function normalizedBirthDate(value: string) {
  const digits = sanitizeBirthDigits(value);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function isBirthDateReady(value: string, calendar: IntakeFormData['calendar'] = 'solar') {
  const digits = sanitizeBirthDigits(value);
  if (digits.length !== 8) return false;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (year < 1900 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1) return false;
  if (calendar === 'lunar') return day <= 30;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseBirthTime(value: string): { period: BirthPeriod; hour: string; minute: string } {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return { period: '', hour: '', minute: '' };

  const [hour24, minute] = value.split(':');
  const numericHour = Number(hour24);
  return {
    period: numericHour >= 12 ? 'pm' : 'am',
    hour: String(numericHour % 12 || 12),
    minute
  };
}

function toExactBirthTime(period: BirthPeriod, hourText: string, minuteText: string) {
  if (!period || !hourText || !minuteText) return '';

  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return '';
  }

  const hour24 = (hour % 12) + (period === 'pm' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toSubmittedFormData(draft: LoveIntakeDraft): IntakeFormData {
  return {
    ...draft,
    name: draft.name.trim(),
    gender: draft.gender === 'male' ? 'male' : 'female',
    birthDate: normalizedBirthDate(draft.birthDate),
    birthTime: draft.isUnknownTime ? '' : draft.birthTime,
    birthTimePrecision: draft.isUnknownTime ? 'unknown' : 'exact',
    interestedIn: draft.interestedIn || undefined,
    loveReaction: getLoveReactionProfile(draft.loveReaction)?.id,
    loveFocus: draft.loveFocus || undefined,
    q1: draft.q1.trim(),
    q2: draft.q2.trim()
  };
}

function validationStep(field: string): IntakeStep {
  if (field === 'birthDate' || field === 'calendar' || field === 'isLeapMonth') return 1;
  if (field === 'birthTime' || field === 'birthTimePrecision') return 2;
  if (field === 'gender') return 3;
  if (field === 'name') return 4;
  return 1;
}

export default function LoveReadingIntake() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const locationState = (location.state as IntakeLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || '/detail/love-reading';
  const draftKey = useMemo(
    () => user?.id ? `${DRAFT_KEY_PREFIX}.${user.id}` : GUEST_DRAFT_KEY,
    [user?.id]
  );
  const locationFormData = !locationState?.draftOwnerId || locationState.draftOwnerId === user?.id
    ? locationState?.formData
    : undefined;
  const initialDraft = useMemo(
    () => {
      const ownedDraft = readStoredDraft(draftKey);
      const guestDraft = user?.id ? null : readStoredDraft(GUEST_DRAFT_KEY);
      return hydrateDraft(
        locationFormData ?? ownedDraft ?? guestDraft,
        locationState?.loveReaction,
        readStoredLoveReaction()
      );
    },
    [draftKey, locationFormData, locationState?.loveReaction, user?.id]
  );
  const initialBirthTime = useMemo(() => parseBirthTime(initialDraft.birthTime), [initialDraft.birthTime]);
  const [step, setStep] = useState<IntakeStep>(1);
  const [draft, setDraft] = useState<LoveIntakeDraft>(initialDraft);
  const [timePeriod, setTimePeriod] = useState<BirthPeriod>(initialBirthTime.period);
  const [timeHour, setTimeHour] = useState(initialBirthTime.hour);
  const [timeMinute, setTimeMinute] = useState(initialBirthTime.minute);
  const [error, setError] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);
  const meta = STEP_META[step];
  const hasSavedAnswers = Boolean(
    draft.birthDate || draft.birthTime || draft.name || draft.gender || draft.interestedIn ||
    draft.relationshipStatus || draft.loveReaction || draft.loveFocus || draft.q1 || draft.q2
  );


  useEffect(() => {
    setDraft(initialDraft);
    setTimePeriod(initialBirthTime.period);
    setTimeHour(initialBirthTime.hour);
    setTimeMinute(initialBirthTime.minute);
  }, [initialBirthTime, initialDraft]);

  useEffect(() => {
    if (typeof window !== 'undefined' && draftKey) {
      window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
      const reactionProfile = getLoveReactionProfile(draft.loveReaction);
      if (reactionProfile) {
        window.sessionStorage.setItem(MZ_LOVE_CHOICE_STORAGE_KEY, reactionProfile.id);
      }
    }
  }, [draft, draftKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    setError('');
  }, [draft]);

  const updateDraft = <K extends keyof LoveIntakeDraft>(key: K, value: LoveIntakeDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const syncExactBirthTime = (period: BirthPeriod, hour: string, minute: string) => {
    const value = toExactBirthTime(period, hour, minute);
    setDraft((current) => ({
      ...current,
      birthTime: value,
      isUnknownTime: false,
      birthTimePrecision: 'exact'
    }));
    return value;
  };

  const advanceWithDraft = (patch: Partial<LoveIntakeDraft>, nextStep: IntakeStep) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError('');
    setStep(nextStep);
  };

  const selectRelationshipStatus = (relationshipStatus: Exclude<RelationshipStatus, ''>) => {
    const requiresDuration = isLoveReadingDurationRequired(relationshipStatus);

    setDraft((current) => ({
      ...current,
      relationshipStatus,
      relationshipDuration: requiresDuration && current.relationshipStatus === relationshipStatus
        ? current.relationshipDuration
        : ''
    }));
    setError('');

    if (!requiresDuration) setStep(6);
  };

  const handleBirthDateChange = (value: string) => {
    const digits = sanitizeBirthDigits(value);
    updateDraft('birthDate', digits);

    if (digits.length !== 8) return;
    if (!isBirthDateReady(digits, draft.calendar)) {
      setError('생년월일을 다시 확인해 줘. 실제 날짜 8자리로 입력해 주세요.');
      return;
    }

    setError('');
    setStep(2);
  };

  const selectCalendar = (calendar: IntakeFormData['calendar']) => {
    setDraft((current) => ({
      ...current,
      calendar,
      isLeapMonth: calendar === 'solar' ? false : current.isLeapMonth
    }));

    if (isBirthDateReady(draft.birthDate, calendar)) {
      setError('');
      setStep(2);
    }
  };

  const selectTimePeriod = (period: Exclude<BirthPeriod, ''>) => {
    setTimePeriod(period);
    const exactTime = syncExactBirthTime(period, timeHour, timeMinute);
    if (exactTime) {
      setStep(3);
      return;
    }
    window.requestAnimationFrame(() => hourInputRef.current?.focus());
  };

  const handleTimeHourChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    setTimeHour(digits);
    syncExactBirthTime(timePeriod, digits, timeMinute);

    const hour = Number(digits);
    if (digits.length === 2 && hour >= 1 && hour <= 12) {
      window.requestAnimationFrame(() => minuteInputRef.current?.focus());
    }
  };

  const completeTime = (minuteValue: string) => {
    const normalizedMinute = minuteValue.length === 1 ? minuteValue.padStart(2, '0') : minuteValue;
    setTimeMinute(normalizedMinute);
    const exactTime = syncExactBirthTime(timePeriod, timeHour, normalizedMinute);
    if (exactTime) {
      setError('');
      setStep(3);
    }
  };

  const handleTimeMinuteChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    setTimeMinute(digits);
    const exactTime = syncExactBirthTime(timePeriod, timeHour, digits);
    if (digits.length === 2 && exactTime) {
      setError('');
      setStep(3);
    }
  };

  const stepReady = useMemo(() => {
    switch (step) {
      case 1:
        return isBirthDateReady(draft.birthDate, draft.calendar);
      case 2:
        return draft.isUnknownTime || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.birthTime);
      case 3:
        return draft.gender === 'male' || draft.gender === 'female';
      case 4:
        return Boolean(draft.name.trim());
      case 5:
        return Boolean(
          draft.relationshipStatus &&
          (!isLoveReadingDurationRequired(draft.relationshipStatus) || draft.relationshipDuration)
        );
      case 6:
        return Boolean(getLoveReactionProfile(draft.loveReaction));
      case 7:
        return Boolean(draft.loveFocus);
      case 8:
        return draft.q1.trim().length >= 4 && draft.q2.trim().length >= 4;
      default:
        return false;
    }
  }, [draft, step]);

  const handleBack = () => {
    setError('');

    if (step === 1) {
      navigate(tabOrigin, { state: { tabOrigin } });
      return;
    }


    setStep((current) => (current - 1) as IntakeStep);
  };

  const resetAnswers = () => {
    try {
      window.sessionStorage.removeItem(MZ_LOVE_CHOICE_STORAGE_KEY);
    } catch {
      // The form can still reset when browser storage is unavailable.
    }
    setDraft(EMPTY_DRAFT);
    setTimePeriod('');
    setTimeHour('');
    setTimeMinute('');
    setStep(1);
    setError('');
  };

  const handleNext = () => {
    if (!stepReady) return;

    if (step < 8) {
      setError('');
      setStep((current) => (current + 1) as IntakeStep);
      return;
    }

    const formData = toSubmittedFormData(draft);
    const birthValidation = validateBirthInput(formData, { subjectLabel: '본인' });

    if (!birthValidation.valid) {
      const firstError = birthValidation.errors[0];
      setError(firstError?.message || '입력한 사주 정보를 다시 확인해 주세요.');
      if (firstError) setStep(validationStep(firstError.field));
      return;
    }

    const contextValidation = validateLoveReadingIntakeContext(formData);
    if (!contextValidation.valid) {
      const firstError = contextValidation.errors[0];
      setError(firstError?.message || '연애운 입력 내용을 다시 확인해 주세요.');
      if (firstError) setStep(firstError.step);
      return;
    }

    if (draftKey) {
      window.sessionStorage.setItem(draftKey, JSON.stringify(formData));
    }
    navigate('/preview/love-reading', {
      state: {
        formData,
        tabOrigin,
        draftOwnerId: user?.id,
        recoveredEntitlement: locationState?.recoveredEntitlement
      }
    });
  };

  const handleInputEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && stepReady) {
      event.preventDefault();
      handleNext();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="mz-love-intake-fields">
            <div className="mz-love-intake-pills" aria-label="양력 또는 음력 선택">
              <button
                type="button"
                aria-pressed={draft.calendar === 'solar'}
                className={draft.calendar === 'solar' ? 'is-selected' : ''}
                onClick={() => selectCalendar('solar')}
              >
                양력
              </button>
              <button
                type="button"
                aria-pressed={draft.calendar === 'lunar'}
                className={draft.calendar === 'lunar' ? 'is-selected' : ''}
                onClick={() => selectCalendar('lunar')}
              >
                음력
              </button>
              {draft.calendar === 'lunar' ? (
                <button
                  type="button"
                  aria-pressed={draft.isLeapMonth}
                  className={draft.isLeapMonth ? 'is-selected is-subtle' : 'is-subtle'}
                  onClick={() => updateDraft('isLeapMonth', !draft.isLeapMonth)}
                >
                  윤달
                </button>
              ) : null}
            </div>
            <label className="mz-love-intake-line-field">
              <span className="sr-only">생년월일 8자리</span>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                maxLength={10}
                value={displayBirthDate(draft.birthDate)}
                placeholder="2000.01.01"
                onChange={(event) => handleBirthDateChange(event.target.value)}
              />
            </label>
            {hasSavedAnswers ? (
              <button type="button" className="mz-love-intake-reset" onClick={resetAnswers}>
                저장된 입력 내용 모두 지우기
              </button>
            ) : null}
          </div>
        );
      case 2:
        return (
          <div className="mz-love-intake-fields">
            <div className="mz-love-intake-time-period" role="group" aria-label="오전 또는 오후 선택">
              <button
                type="button"
                aria-pressed={timePeriod === 'am'}
                className={timePeriod === 'am' ? 'is-selected' : ''}
                onClick={() => selectTimePeriod('am')}
              >
                오전
              </button>
              <button
                type="button"
                aria-pressed={timePeriod === 'pm'}
                className={timePeriod === 'pm' ? 'is-selected' : ''}
                onClick={() => selectTimePeriod('pm')}
              >
                오후
              </button>
            </div>
            <div className="mz-love-intake-time-fields">
              <label>
                <span className="sr-only">태어난 시</span>
                <input
                  ref={hourInputRef}
                  autoFocus={!timePeriod}
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="next"
                  maxLength={2}
                  value={timeHour}
                  placeholder="12"
                  aria-label="태어난 시, 1부터 12"
                  onChange={(event) => handleTimeHourChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      minuteInputRef.current?.focus();
                    }
                  }}
                />
                <b>시</b>
              </label>
              <i aria-hidden="true">:</i>
              <label>
                <span className="sr-only">태어난 분</span>
                <input
                  ref={minuteInputRef}
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="next"
                  maxLength={2}
                  value={timeMinute}
                  placeholder="30"
                  aria-label="태어난 분, 0부터 59"
                  onChange={(event) => handleTimeMinuteChange(event.target.value)}
                  onBlur={() => timeMinute && completeTime(timeMinute)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      completeTime(timeMinute);
                    }
                  }}
                />
                <b>분</b>
              </label>
            </div>
            <button
              type="button"
              aria-pressed={draft.isUnknownTime}
              className={`mz-love-intake-unknown ${draft.isUnknownTime ? 'is-selected' : ''}`}
              onClick={() => advanceWithDraft({
                isUnknownTime: true,
                birthTime: '',
                birthTimePrecision: 'unknown'
              }, 3)}
            >
              <span>{draft.isUnknownTime ? <Check size={17} aria-hidden="true" /> : null}</span>
              태어난 시간을 몰라요
            </button>
            <p className="mz-love-intake-note">시간을 모르면 12개 시주 가능성을 비교해, 확실한 부분만 보여드려요.</p>
          </div>
        );
      case 3:
        return (
          <div className="mz-love-intake-option-stack mz-love-intake-option-stack--gender">
            {([
              ['male', '남자'],
              ['female', '여자']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={draft.gender === value}
                className={draft.gender === value ? 'is-selected' : ''}
                onClick={() => advanceWithDraft({
                  gender: value,
                  interestedIn: 'prefer-not-to-say'
                }, 4)}
              >
                <strong>{label}</strong>
                <i>{draft.gender === value ? <Check size={18} aria-hidden="true" /> : null}</i>
              </button>
            ))}
          </div>
        );
      case 4:
        return (
          <div className="mz-love-intake-fields">
            <div className="mz-love-intake-name-row">
              <label className="mz-love-intake-line-field">
                <span className="sr-only">이름 또는 닉네임</span>
                <input
                  autoFocus
                  type="text"
                  autoComplete="name"
                  maxLength={20}
                  value={draft.name}
                  placeholder="홍길동"
                  enterKeyHint="next"
                  onChange={(event) => updateDraft('name', event.target.value)}
                  onKeyDown={handleInputEnter}
                />
              </label>
              <button
                type="button"
                className="mz-love-intake-name-confirm"
                disabled={!draft.name.trim()}
                onClick={handleNext}
              >
                <Check size={18} aria-hidden="true" />
                <span>확인</span>
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="mz-love-intake-fields">
            <div className="mz-love-intake-option-stack">
              {RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={draft.relationshipStatus === option.value}
                  className={draft.relationshipStatus === option.value ? 'is-selected' : ''}
                  onClick={() => selectRelationshipStatus(option.value)}
                >
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <i>{draft.relationshipStatus === option.value ? <Check size={18} aria-hidden="true" /> : null}</i>
                </button>
              ))}
            </div>

            {isLoveReadingDurationRequired(draft.relationshipStatus) ? (
              <div className="mz-love-intake-duration">
                <span>{draft.relationshipStatus === 'married' ? '결혼 생활 기간' : '연애 기간'}을 골라줘</span>
                <div role="group" aria-label={draft.relationshipStatus === 'married' ? '결혼 생활 기간' : '연애 기간'}>
                  {RELATIONSHIP_DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={draft.relationshipDuration === option.value}
                      className={draft.relationshipDuration === option.value ? 'is-selected' : ''}
                      onClick={() => advanceWithDraft({ relationshipDuration: option.value }, 6)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      case 6:
        return (
          <div className="mz-love-intake-option-stack">
            {LOVE_REACTION_PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                aria-pressed={draft.loveReaction === profile.id}
                className={draft.loveReaction === profile.id ? 'is-selected' : ''}
                onClick={() => advanceWithDraft({ loveReaction: profile.id }, 7)}
              >
                <span>
                  <strong>{profile.id}. {profile.label}</strong>
                  <small>{profile.intakeHint}</small>
                </span>
                <i>{draft.loveReaction === profile.id ? <Check size={18} aria-hidden="true" /> : null}</i>
              </button>
            ))}
          </div>
        );
      case 7:
        return (
          <div className="mz-love-intake-option-stack">
            {LOVE_FOCUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draft.loveFocus === option.value}
                className={draft.loveFocus === option.value ? 'is-selected' : ''}
                onClick={() => advanceWithDraft({ loveFocus: option.value }, 8)}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                <i>{draft.loveFocus === option.value ? <Check size={18} aria-hidden="true" /> : null}</i>
              </button>
            ))}
          </div>
        );
      case 8:
        return (
          <div className="mz-love-intake-question-stack">
            <p className="mz-love-intake-note">
              제3자의 실명, 전화번호, 주소, 계정 ID 같은 개인정보는 적지 마세요. 상대는 이름 대신 ‘현재 만나는 사람’처럼 표현해 주세요.
            </p>
            <label>
              <span><em>1</em> 첫 번째 질문</span>
              <textarea
                autoFocus
                rows={3}
                maxLength={240}
                value={draft.q1}
                placeholder="예: 지금 관계에서 제가 먼저 확인해야 할 신호가 궁금해요."
                onChange={(event) => updateDraft('q1', event.target.value)}
              />
              <small>{draft.q1.length} / 240</small>
            </label>
            <label>
              <span><em>2</em> 두 번째 질문</span>
              <textarea
                rows={3}
                maxLength={240}
                value={draft.q2}
                placeholder="예: 다음 연애에서 제가 꼭 바꿔야 할 행동은 뭔가요?"
                onChange={(event) => updateDraft('q2', event.target.value)}
              />
              <small>{draft.q2.length} / 240</small>
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="mz-love-intake-page">
      <div className="mz-love-intake-background" aria-hidden="true">
        {videoFailed ? (
          <img src={BACKGROUND_POSTER} alt="" />
        ) : (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={BACKGROUND_POSTER}
            onError={() => setVideoFailed(true)}
          >
            <source src={BACKGROUND_VIDEO} type="video/mp4" />
          </video>
        )}
        <span />
      </div>

      <header className="mz-love-intake-header">
        <div>
          <button type="button" onClick={handleBack} aria-label={step === 1 ? '연애운 상세로 돌아가기' : '이전 단계'}>
            <ArrowLeft size={25} aria-hidden="true" />
          </button>
          <strong>MZ무당 팩폭 연애운</strong>
          <span aria-hidden="true" />
        </div>
      </header>

      <section className="mz-love-intake-content" key={step} aria-live="polite">
        <div className="mz-love-intake-copy">
          <h1>{meta.title}</h1>
          <p>{meta.guide}</p>
        </div>
        {renderStep()}
        {error ? <p className="mz-love-intake-error" role="alert">{error}</p> : null}
      </section>

      {step === 8 ? (
        <footer className="mz-love-intake-footer">
          <button type="button" disabled={!stepReady} onClick={handleNext}>
            <Sparkles size={18} aria-hidden="true" />
            <strong>내 사주 원국 미리보기</strong>
          </button>
        </footer>
      ) : null}
    </main>
  );
}
