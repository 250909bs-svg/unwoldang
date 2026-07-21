import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  IntakeFormData,
  PartnerBirthData,
  RelationshipStatus
} from '../api/mockData';
import { validateIntakeBirthInputs } from '../lib/birthInputValidation';
import '../styles/mz-compatibility-intake.css';

export type CompatibilityServiceId = 'match-couple' | 'match-destiny';

type CompatibilityIntakeProps = {
  serviceId: CompatibilityServiceId;
};

type CompatibilityLocationState = {
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

type IntakeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
type PersonKey = 'self' | 'partner';
type BirthPeriod = '' | 'am' | 'pm';

type PersonDraft = Omit<PartnerBirthData, 'gender'> & {
  gender: '' | PartnerBirthData['gender'];
};

type CompatibilityDraft = {
  self: PersonDraft;
  partner: PersonDraft;
  relationshipStatus: RelationshipStatus;
  q1: string;
  q2: string;
};

type TimeEntry = {
  period: BirthPeriod;
  hour: string;
  minute: string;
};

const BACKGROUND_VIDEO = '/media/mz-love-intake-background.mp4';
const BACKGROUND_POSTER = '/home-match-couple-card.png';
const TOTAL_STEPS = 11;

const PRODUCT_META: Record<CompatibilityServiceId, {
  title: string;
  eyebrow: string;
  q1Placeholder: string;
  q2Placeholder: string;
  checkoutLabel: string;
}> = {
  'match-couple': {
    title: '월연도령 사주궁합',
    eyebrow: '두 사람의 결을 맞추는 중',
    q1Placeholder: '예: 서로 좋아하는데 자꾸 같은 문제로 부딪히는 이유가 궁금해요.',
    q2Placeholder: '예: 오래 만나려면 우리 둘이 가장 먼저 맞춰야 할 것은 무엇인가요?',
    checkoutLabel: '사주궁합 결제 정보 확인'
  },
  'match-destiny': {
    title: '월연도령 운명 궁합',
    eyebrow: '두 사람의 인연을 잇는 중',
    q1Placeholder: '예: 이 사람이 오래 함께할 인연인지 궁금해요.',
    q2Placeholder: '예: 이 관계를 지키려면 현실에서 무엇을 확인해야 하나요?',
    checkoutLabel: '운명궁합 결제 정보 확인'
  }
};

const STEP_META: Record<IntakeStep, { title: string; guide: string }> = {
  1: {
    title: '먼저, 네 생년월일을 알려줘',
    guide: '두 사람의 원국을 나란히 놓기 위한 첫 번째 단서야.'
  },
  2: {
    title: '너는 몇 시에 태어났어?',
    guide: '정확한 시간을 알면 감정의 속도와 관계 시기를 더 촘촘하게 볼 수 있어.'
  },
  3: {
    title: '네 성별은?',
    guide: '대운의 방향과 관계 흐름을 계산할 때 반영할게.'
  },
  4: {
    title: '너를 뭐라고 부를까?',
    guide: '이제부터는 네 이름을 부르면서 두 사람의 이야기를 풀어줄게.'
  },
  5: {
    title: '상대방의 생년월일은?',
    guide: '이번에는 상대의 원국을 열어 서로 닿는 지점을 찾아볼게.'
  },
  6: {
    title: '상대방은 몇 시에 태어났어?',
    guide: '시간을 모르면 가능한 시주를 비교해 공통으로 확인되는 부분만 사용할게.'
  },
  7: {
    title: '상대방의 성별은?',
    guide: '상대의 대운 방향과 관계 흐름을 계산하는 데 필요해.'
  },
  8: {
    title: '상대방을 뭐라고 부를까?',
    guide: '실명 대신 둘만 아는 호칭이나 이니셜을 적어도 괜찮아.'
  },
  9: {
    title: '두 사람은 지금 어떤 사이야?',
    guide: '같은 궁합도 현재 관계에 따라 현실적인 조언이 달라져.'
  },
  10: {
    title: '첫 번째로 뭘 알고 싶어?',
    guide: '지금 가장 마음에 걸리는 장면을 하나만 구체적으로 적어줘.'
  },
  11: {
    title: '마지막으로 하나만 더 물을게',
    guide: '첫 질문과 다른 방향을 물으면 두 사람의 관계를 더 입체적으로 볼 수 있어.'
  }
};

const RELATIONSHIP_OPTIONS: ReadonlyArray<{
  value: Exclude<RelationshipStatus, '' | 'single'>;
  label: string;
  detail: string;
}> = [
  { value: 'situationship', label: '썸 타는 중', detail: '호감은 있지만 아직 관계를 정하지 않았어요' },
  { value: 'dating', label: '연애 중', detail: '현재 만나고 있는 연인이에요' },
  { value: 'ambiguous', label: '애매한 사이', detail: '연락과 감정은 있지만 관계가 모호해요' },
  { value: 'breakup-reunion', label: '이별·재회 고민', detail: '헤어진 뒤 관계의 방향을 고민하고 있어요' },
  { value: 'married', label: '부부', detail: '결혼 후의 생활과 관계 흐름을 보고 싶어요' }
];

const emptyPerson = (): PersonDraft => ({
  name: '',
  gender: '',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight'
});

const EMPTY_DRAFT: CompatibilityDraft = {
  self: emptyPerson(),
  partner: emptyPerson(),
  relationshipStatus: '',
  q1: '',
  q2: ''
};

function sanitizeBirthDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8);
}

function displayBirthDate(value: string) {
  const digits = sanitizeBirthDigits(value);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function normalizeBirthDate(value: string) {
  const digits = sanitizeBirthDigits(value);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function isBirthDateReady(value: string, calendar: PersonDraft['calendar']) {
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

function parseBirthTime(value: string): TimeEntry {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return { period: '', hour: '', minute: '' };
  }

  const [hour24, minute] = value.split(':');
  const numericHour = Number(hour24);
  return {
    period: numericHour >= 12 ? 'pm' : 'am',
    hour: String(numericHour % 12 || 12),
    minute
  };
}

function toExactBirthTime(entry: TimeEntry) {
  if (!entry.period || !entry.hour || !entry.minute) return '';

  const hour = Number(entry.hour);
  const minute = Number(entry.minute);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return '';
  }

  const hour24 = (hour % 12) + (entry.period === 'pm' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function hydratePerson(source?: Partial<PersonDraft> | null): PersonDraft {
  const gender = source?.gender === 'male' || source?.gender === 'female' ? source.gender : '';
  const calendar = source?.calendar === 'lunar' ? 'lunar' : 'solar';
  const isUnknownTime = Boolean(source?.isUnknownTime);

  return {
    ...emptyPerson(),
    ...source,
    name: source?.name ?? '',
    gender,
    calendar,
    isLeapMonth: calendar === 'lunar' && Boolean(source?.isLeapMonth),
    birthDate: source?.birthDate ?? '',
    birthTime: isUnknownTime ? '' : source?.birthTime ?? '',
    isUnknownTime,
    birthTimePrecision: isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: source?.dayBoundaryPolicy === 'late-zi' ? 'late-zi' : 'midnight'
  };
}

function draftFromFormData(source?: Partial<IntakeFormData> | null): CompatibilityDraft {
  if (!source) return EMPTY_DRAFT;

  return {
    self: hydratePerson(source),
    partner: hydratePerson(source.partner),
    relationshipStatus: source.relationshipStatus ?? '',
    q1: source.q1 ?? '',
    q2: source.q2 ?? ''
  };
}

function readStoredDraft(key: string): CompatibilityDraft | null {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CompatibilityDraft>;
    return {
      self: hydratePerson(parsed.self),
      partner: hydratePerson(parsed.partner),
      relationshipStatus: parsed.relationshipStatus ?? '',
      q1: typeof parsed.q1 === 'string' ? parsed.q1 : '',
      q2: typeof parsed.q2 === 'string' ? parsed.q2 : ''
    };
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function toSubmittedFormData(draft: CompatibilityDraft): IntakeFormData {
  return {
    name: draft.self.name.trim(),
    gender: draft.self.gender as IntakeFormData['gender'],
    calendar: draft.self.calendar,
    isLeapMonth: draft.self.isLeapMonth,
    birthDate: normalizeBirthDate(draft.self.birthDate),
    birthTime: draft.self.isUnknownTime ? '' : draft.self.birthTime,
    isUnknownTime: draft.self.isUnknownTime,
    birthTimePrecision: draft.self.isUnknownTime ? 'unknown' : 'exact',
    dayBoundaryPolicy: draft.self.dayBoundaryPolicy || 'midnight',
    birthLocation: draft.self.birthLocation,
    partner: {
      name: draft.partner.name.trim(),
      gender: draft.partner.gender as PartnerBirthData['gender'],
      calendar: draft.partner.calendar,
      isLeapMonth: draft.partner.isLeapMonth,
      birthDate: normalizeBirthDate(draft.partner.birthDate),
      birthTime: draft.partner.isUnknownTime ? '' : draft.partner.birthTime,
      isUnknownTime: draft.partner.isUnknownTime,
      birthTimePrecision: draft.partner.isUnknownTime ? 'unknown' : 'exact',
      dayBoundaryPolicy: draft.partner.dayBoundaryPolicy || 'midnight',
      birthLocation: draft.partner.birthLocation
    },
    relationshipStatus: draft.relationshipStatus,
    relationshipDuration: '',
    location: draft.self.birthLocation?.label || '',
    q1: draft.q1.trim(),
    q2: draft.q2.trim()
  };
}

function validationStep(field: string, person: PersonKey): IntakeStep {
  const offset = person === 'self' ? 0 : 4;
  if (field === 'birthDate' || field === 'calendar' || field === 'isLeapMonth') return (1 + offset) as IntakeStep;
  if (field === 'birthTime' || field === 'birthTimePrecision' || field === 'dayBoundaryPolicy') return (2 + offset) as IntakeStep;
  if (field === 'gender') return (3 + offset) as IntakeStep;
  return (4 + offset) as IntakeStep;
}

export default function CompatibilityIntake({ serviceId }: CompatibilityIntakeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as CompatibilityLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || `/detail/${serviceId}`;
  const draftKey = `unwoldang.compatibility-intake.v1.${serviceId}`;
  const initialDraft = useMemo(
    () => locationState?.formData
      ? draftFromFormData(locationState.formData)
      : readStoredDraft(draftKey) ?? EMPTY_DRAFT,
    [draftKey, locationState?.formData]
  );
  const [draft, setDraft] = useState<CompatibilityDraft>(initialDraft);
  const [step, setStep] = useState<IntakeStep>(1);
  const [selfTime, setSelfTime] = useState<TimeEntry>(() => parseBirthTime(initialDraft.self.birthTime));
  const [partnerTime, setPartnerTime] = useState<TimeEntry>(() => parseBirthTime(initialDraft.partner.birthTime));
  const [error, setError] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);
  const meta = PRODUCT_META[serviceId];
  const stepMeta = STEP_META[step];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
    }
  }, [draft, draftKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const updatePerson = <K extends keyof PersonDraft>(person: PersonKey, key: K, value: PersonDraft[K]) => {
    setDraft((current) => ({
      ...current,
      [person]: {
        ...current[person],
        [key]: value
      }
    }));
    setError('');
  };

  const advance = (nextStep: IntakeStep) => {
    setError('');
    setStep(nextStep);
  };

  const handleBirthDateChange = (person: PersonKey, value: string, nextStep: IntakeStep) => {
    const digits = sanitizeBirthDigits(value);
    const calendar = draft[person].calendar;
    updatePerson(person, 'birthDate', digits);

    if (digits.length !== 8) return;
    if (!isBirthDateReady(digits, calendar)) {
      setError(`${person === 'self' ? '본인' : '상대방'}의 생년월일을 실제 날짜 8자리로 다시 확인해 줘.`);
      return;
    }

    advance(nextStep);
  };

  const selectCalendar = (person: PersonKey, calendar: PersonDraft['calendar'], nextStep: IntakeStep) => {
    setDraft((current) => ({
      ...current,
      [person]: {
        ...current[person],
        calendar,
        isLeapMonth: calendar === 'solar' ? false : current[person].isLeapMonth
      }
    }));
    setError('');

    if (isBirthDateReady(draft[person].birthDate, calendar)) {
      advance(nextStep);
    }
  };

  const currentTimeEntry = (person: PersonKey) => person === 'self' ? selfTime : partnerTime;

  const setTimeEntry = (person: PersonKey, value: TimeEntry) => {
    if (person === 'self') setSelfTime(value);
    else setPartnerTime(value);
  };

  const syncExactBirthTime = (person: PersonKey, value: TimeEntry) => {
    const birthTime = toExactBirthTime(value);
    setTimeEntry(person, value);
    setDraft((current) => ({
      ...current,
      [person]: {
        ...current[person],
        birthTime,
        isUnknownTime: false,
        birthTimePrecision: 'exact'
      }
    }));
    setError('');
    return birthTime;
  };

  const selectTimePeriod = (
    person: PersonKey,
    period: Exclude<BirthPeriod, ''>,
    nextStep: IntakeStep
  ) => {
    const value = { ...currentTimeEntry(person), period };
    const birthTime = syncExactBirthTime(person, value);
    if (birthTime) {
      advance(nextStep);
      return;
    }
    window.requestAnimationFrame(() => hourInputRef.current?.focus());
  };

  const handleTimeHourChange = (person: PersonKey, value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    const current = currentTimeEntry(person);
    syncExactBirthTime(person, { ...current, hour: digits });

    const hour = Number(digits);
    if (digits.length === 2 && hour >= 1 && hour <= 12) {
      window.requestAnimationFrame(() => minuteInputRef.current?.focus());
    }
  };

  const completeTime = (person: PersonKey, minuteValue: string, nextStep: IntakeStep) => {
    const normalizedMinute = minuteValue.length === 1 ? minuteValue.padStart(2, '0') : minuteValue;
    const value = { ...currentTimeEntry(person), minute: normalizedMinute };
    const birthTime = syncExactBirthTime(person, value);
    if (birthTime) advance(nextStep);
  };

  const handleTimeMinuteChange = (person: PersonKey, value: string, nextStep: IntakeStep) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    const next = { ...currentTimeEntry(person), minute: digits };
    const birthTime = syncExactBirthTime(person, next);
    if (digits.length === 2 && birthTime) advance(nextStep);
  };

  const selectUnknownTime = (person: PersonKey, nextStep: IntakeStep) => {
    setTimeEntry(person, { period: '', hour: '', minute: '' });
    setDraft((current) => ({
      ...current,
      [person]: {
        ...current[person],
        birthTime: '',
        isUnknownTime: true,
        birthTimePrecision: 'unknown'
      }
    }));
    advance(nextStep);
  };

  const selectGender = (
    person: PersonKey,
    gender: PartnerBirthData['gender'],
    nextStep: IntakeStep
  ) => {
    updatePerson(person, 'gender', gender);
    advance(nextStep);
  };

  const completeName = (person: PersonKey, nextStep: IntakeStep) => {
    if (!draft[person].name.trim()) {
      setError('이름 또는 둘만 아는 호칭을 한 글자 이상 입력해 줘.');
      return;
    }
    advance(nextStep);
  };

  const handleNameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    person: PersonKey,
    nextStep: IntakeStep
  ) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      completeName(person, nextStep);
    }
  };

  const handleFirstQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && draft.q1.trim().length >= 4) {
      event.preventDefault();
      advance(11);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 1) {
      navigate(tabOrigin, { state: { tabOrigin } });
      return;
    }
    setStep((current) => (current - 1) as IntakeStep);
  };

  const handleCheckout = () => {
    if (draft.q2.trim().length < 4) return;

    const formData = toSubmittedFormData(draft);
    const validation = validateIntakeBirthInputs(formData, { requirePartner: true });

    if (!validation.self.valid) {
      const firstError = validation.self.errors[0];
      setError(firstError?.message || '본인의 사주 정보를 다시 확인해 줘.');
      if (firstError) setStep(validationStep(firstError.field, 'self'));
      return;
    }

    if (!validation.partner?.valid) {
      const firstError = validation.partner?.errors[0];
      setError(firstError?.message || '상대방의 사주 정보를 다시 확인해 줘.');
      if (firstError) setStep(validationStep(firstError.field, 'partner'));
      return;
    }

    if (!draft.relationshipStatus) {
      setError('두 사람의 현재 관계를 선택해 줘.');
      setStep(9);
      return;
    }

    if (draft.q1.trim().length < 4) {
      setError('첫 번째 질문을 네 글자 이상 적어줘.');
      setStep(10);
      return;
    }

    window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
    if (locationState?.recoveredEntitlement) {
      navigate('/loading', {
        state: {
          product: serviceId,
          formData,
          paymentMethod: 'portone',
          orderId: locationState.recoveredEntitlement.orderId,
          reportAccessToken: locationState.recoveredEntitlement.reportAccessToken,
          tabOrigin
        }
      });
      return;
    }

    navigate('/checkout', {
      state: {
        product: serviceId,
        formData,
        tabOrigin
      }
    });
  };

  const renderBirthDate = (person: PersonKey, nextStep: IntakeStep) => {
    const value = draft[person];
    const subjectLabel = person === 'self' ? '본인' : '상대방';

    return (
      <div className="mz-compatibility-fields">
        <div className="mz-compatibility-pills" role="group" aria-label={`${subjectLabel} 양력 또는 음력 선택`}>
          <button
            type="button"
            aria-pressed={value.calendar === 'solar'}
            className={value.calendar === 'solar' ? 'is-selected' : ''}
            onClick={() => selectCalendar(person, 'solar', nextStep)}
          >
            양력
          </button>
          <button
            type="button"
            aria-pressed={value.calendar === 'lunar'}
            className={value.calendar === 'lunar' ? 'is-selected' : ''}
            onClick={() => selectCalendar(person, 'lunar', nextStep)}
          >
            음력
          </button>
          {value.calendar === 'lunar' ? (
            <button
              type="button"
              aria-pressed={value.isLeapMonth}
              className={value.isLeapMonth ? 'is-selected is-subtle' : 'is-subtle'}
              onClick={() => updatePerson(person, 'isLeapMonth', !value.isLeapMonth)}
            >
              윤달
            </button>
          ) : null}
        </div>

        <label className="mz-compatibility-line-field">
          <span className="sr-only">{subjectLabel} 생년월일 8자리</span>
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            autoComplete={person === 'self' ? 'bday' : 'off'}
            maxLength={10}
            value={displayBirthDate(value.birthDate)}
            placeholder="2000.01.01"
            onChange={(event) => handleBirthDateChange(person, event.target.value, nextStep)}
          />
        </label>
        <p className="mz-compatibility-input-hint">날짜 8자리가 완성되면 자동으로 다음 문이 열려.</p>
      </div>
    );
  };

  const renderBirthTime = (person: PersonKey, nextStep: IntakeStep) => {
    const value = currentTimeEntry(person);
    const subjectLabel = person === 'self' ? '본인' : '상대방';

    return (
      <div className="mz-compatibility-fields">
        <div className="mz-compatibility-time-period" role="group" aria-label={`${subjectLabel} 오전 또는 오후 선택`}>
          <button
            type="button"
            aria-pressed={value.period === 'am'}
            className={value.period === 'am' ? 'is-selected' : ''}
            onClick={() => selectTimePeriod(person, 'am', nextStep)}
          >
            오전
          </button>
          <button
            type="button"
            aria-pressed={value.period === 'pm'}
            className={value.period === 'pm' ? 'is-selected' : ''}
            onClick={() => selectTimePeriod(person, 'pm', nextStep)}
          >
            오후
          </button>
        </div>

        <div className="mz-compatibility-time-fields">
          <label>
            <span className="sr-only">{subjectLabel} 태어난 시</span>
            <input
              ref={hourInputRef}
              autoFocus={!value.period}
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              maxLength={2}
              value={value.hour}
              placeholder="12"
              aria-label={`${subjectLabel} 태어난 시, 1부터 12`}
              onChange={(event) => handleTimeHourChange(person, event.target.value)}
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
            <span className="sr-only">{subjectLabel} 태어난 분</span>
            <input
              ref={minuteInputRef}
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              maxLength={2}
              value={value.minute}
              placeholder="30"
              aria-label={`${subjectLabel} 태어난 분, 0부터 59`}
              onChange={(event) => handleTimeMinuteChange(person, event.target.value, nextStep)}
              onBlur={() => value.minute && completeTime(person, value.minute, nextStep)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  completeTime(person, value.minute, nextStep);
                }
              }}
            />
            <b>분</b>
          </label>
        </div>

        <button
          type="button"
          className={`mz-compatibility-unknown ${draft[person].isUnknownTime ? 'is-selected' : ''}`}
          aria-pressed={draft[person].isUnknownTime}
          onClick={() => selectUnknownTime(person, nextStep)}
        >
          <span>{draft[person].isUnknownTime ? <Check size={17} aria-hidden="true" /> : null}</span>
          태어난 시간을 몰라요
        </button>
        <p className="mz-compatibility-input-hint">시간을 모르면 가능한 시주를 비교해 공통 근거만 보여줄게.</p>
      </div>
    );
  };

  const renderGender = (person: PersonKey, nextStep: IntakeStep) => (
    <div className="mz-compatibility-option-stack mz-compatibility-option-stack--gender" role="group" aria-label={person === 'self' ? '본인 성별' : '상대방 성별'}>
      {([['male', '남자'], ['female', '여자']] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={draft[person].gender === value}
          className={draft[person].gender === value ? 'is-selected' : ''}
          onClick={() => selectGender(person, value, nextStep)}
        >
          <strong>{label}</strong>
          <i>{draft[person].gender === value ? <Check size={18} aria-hidden="true" /> : null}</i>
        </button>
      ))}
    </div>
  );

  const renderName = (person: PersonKey, nextStep: IntakeStep) => (
    <div className="mz-compatibility-fields">
      <label className="mz-compatibility-line-field">
        <span className="sr-only">{person === 'self' ? '본인 이름 또는 닉네임' : '상대방 이름 또는 호칭'}</span>
        <input
          autoFocus
          type="text"
          autoComplete={person === 'self' ? 'name' : 'off'}
          enterKeyHint="next"
          maxLength={20}
          value={draft[person].name}
          placeholder={person === 'self' ? '홍길동' : '상대방 이름 또는 호칭'}
          onChange={(event) => updatePerson(person, 'name', event.target.value)}
          onKeyDown={(event) => handleNameKeyDown(event, person, nextStep)}
        />
      </label>
      <p className="mz-compatibility-input-hint">입력한 뒤 키보드의 다음을 누르면 바로 넘어가.</p>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderBirthDate('self', 2);
      case 2:
        return renderBirthTime('self', 3);
      case 3:
        return renderGender('self', 4);
      case 4:
        return renderName('self', 5);
      case 5:
        return renderBirthDate('partner', 6);
      case 6:
        return renderBirthTime('partner', 7);
      case 7:
        return renderGender('partner', 8);
      case 8:
        return renderName('partner', 9);
      case 9:
        return (
          <div className="mz-compatibility-option-stack">
            {RELATIONSHIP_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draft.relationshipStatus === option.value}
                className={draft.relationshipStatus === option.value ? 'is-selected' : ''}
                onClick={() => {
                  setDraft((current) => ({ ...current, relationshipStatus: option.value }));
                  advance(10);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                <i>{draft.relationshipStatus === option.value ? <Check size={18} aria-hidden="true" /> : null}</i>
              </button>
            ))}
          </div>
        );
      case 10:
        return (
          <div className="mz-compatibility-question-wrap">
            <label>
              <span className="sr-only">궁합 첫 번째 질문</span>
              <textarea
                autoFocus
                rows={5}
                maxLength={240}
                value={draft.q1}
                placeholder={meta.q1Placeholder}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, q1: event.target.value }));
                  setError('');
                }}
                onKeyDown={handleFirstQuestionKeyDown}
              />
              <small>{draft.q1.length} / 240</small>
            </label>
            <p className="mz-compatibility-input-hint">줄바꿈은 Shift+Enter, 입력 완료는 Enter를 눌러줘.</p>
          </div>
        );
      case 11:
        return (
          <div className="mz-compatibility-question-wrap">
            <label>
              <span className="sr-only">궁합 두 번째 질문</span>
              <textarea
                autoFocus
                rows={5}
                maxLength={240}
                value={draft.q2}
                placeholder={meta.q2Placeholder}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, q2: event.target.value }));
                  setError('');
                }}
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
    <main className={`mz-compatibility-intake-page ${serviceId === 'match-destiny' ? 'is-destiny' : ''}`}>
      <div className="mz-compatibility-background" aria-hidden="true">
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

      <header className="mz-compatibility-header">
        <div>
          <button type="button" onClick={handleBack} aria-label={step === 1 ? '궁합 영상으로 돌아가기' : '이전 질문'}>
            <ArrowLeft size={25} aria-hidden="true" />
          </button>
          <strong>{meta.title}</strong>
          <span aria-hidden="true" />
        </div>
        <div className="mz-compatibility-progress" aria-label={`${TOTAL_STEPS}단계 중 ${step}단계`}>
          <i style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </header>

      <section className="mz-compatibility-content" key={step} aria-live="polite">
        <div className="mz-compatibility-copy">
          <small>{meta.eyebrow}</small>
          <h1>{stepMeta.title}</h1>
          <p>{stepMeta.guide}</p>
        </div>
        {renderStep()}
        {error ? <p className="mz-compatibility-error" role="alert">{error}</p> : null}
      </section>

      {step === 11 ? (
        <footer className="mz-compatibility-footer">
          <button type="button" disabled={draft.q2.trim().length < 4} onClick={handleCheckout}>
            <Sparkles size={18} aria-hidden="true" />
            <strong>{meta.checkoutLabel}</strong>
          </button>
        </footer>
      ) : null}
    </main>
  );
}
