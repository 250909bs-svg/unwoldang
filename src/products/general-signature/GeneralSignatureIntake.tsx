import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IntakeFormData, RelationshipStatus } from '../../api/mockData';
import { findServiceById } from '../../api/mockData';
import { useAuth } from '../../context/AuthContext';
import { validateBirthInput } from '../../lib/birthInputValidation';
import { normalizeIntakeFormData } from '../../lib/intakeDataContract';
import { requestGeneralSignatureReleasePreflight } from '../../lib/releasePreflight';
import {
  GENERAL_SIGNATURE_DRAFT_KEY,
  GENERAL_SIGNATURE_QUESTION_MIN_LENGTH,
  canContinueManualReviewInLocalPreview,
  isGeneralSignatureGenderSelected,
  isGeneralSignatureQuestionReady,
  isGeneralSignatureRelationshipReady
} from './generalSignatureIntakeContract';
import {
  type GeneralSignatureIntakeStep,
  getNextGeneralSignatureStep,
  parseTypedBirthTime
} from './generalSignatureIntakeFlow';
import './generalSignatureIntake.css';

const SERVICE_ID = 'general-signature';
const VIDEO_SOURCE = '/general-saju-entry.mp4';

const initialFormData: IntakeFormData = {
  name: '',
  gender: '',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: '',
  relationshipDuration: '',
  location: '',
  q1: '',
  q2: ''
};

const birthLocationOptions = [
  { label: '지역 모름 · 표준시 기준', latitude: undefined, longitude: undefined },
  { label: '서울', latitude: 37.5665, longitude: 126.978 },
  { label: '인천', latitude: 37.4563, longitude: 126.7052 },
  { label: '수원', latitude: 37.2636, longitude: 127.0286 },
  { label: '대전', latitude: 36.3504, longitude: 127.3845 },
  { label: '대구', latitude: 35.8714, longitude: 128.6014 },
  { label: '광주', latitude: 35.1595, longitude: 126.8526 },
  { label: '부산', latitude: 35.1796, longitude: 129.0756 },
  { label: '울산', latitude: 35.5384, longitude: 129.3114 },
  { label: '제주', latitude: 33.4996, longitude: 126.5312 }
] as const;

const relationshipStatusOptions = [
  { value: 'single', label: '솔로' },
  { value: 'situationship', label: '썸 타는 중' },
  { value: 'dating', label: '연애 중' }
] as const satisfies ReadonlyArray<{ value: Exclude<RelationshipStatus, ''>; label: string }>;

const relationshipDurationOptions = [
  { value: 'under1', label: '1년 이내' },
  { value: 'under3', label: '1년 이상' },
  { value: 'under5', label: '3년 이상' },
  { value: 'under10', label: '5년 이상' }
] as const;

type FormLocationState = {
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

type ReleasePreflightUiState = {
  status: 'idle' | 'checking' | 'manual-review-required' | 'blocked' | 'error';
  message: string;
};

const sanitizeDigits = (value: string, maxLength: number) => value.replace(/\D/g, '').slice(0, maxLength);

function formatBirthDateInput(digits: string) {
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function normalizeBirthDate(digits: string, calendar: IntakeFormData['calendar']) {
  if (digits.length !== 8) return '';

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (year < 1900 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1) return '';

  if (calendar === 'lunar') {
    return day <= 30 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : '';
  }

  const probe = new Date(year, month - 1, day);
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day
    ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : '';
}

function hydrateFormData(source?: Partial<IntakeFormData> | null): IntakeFormData {
  const normalized = normalizeIntakeFormData({
    ...initialFormData,
    ...source,
    name: source?.name ?? '',
    relationshipStatus: source?.relationshipStatus ?? '',
    relationshipDuration: source?.relationshipDuration ?? '',
    q1: source?.q1 ?? '',
    q2: source?.q2 ?? ''
  });

  return {
    ...normalized,
    gender: isGeneralSignatureGenderSelected(source?.gender) ? source!.gender : ''
  } as IntakeFormData;
}

export default function GeneralSignatureIntake() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const service = findServiceById(SERVICE_ID);
  const locationState = (location.state as FormLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || '/detail/general-saju';
  const [step, setStep] = useState<GeneralSignatureIntakeStep>('name');
  const [formData, setFormData] = useState<IntakeFormData>(initialFormData);
  const [birthDigits, setBirthDigits] = useState('');
  const [birthTimeInput, setBirthTimeInput] = useState('');
  const [birthTimeTouched, setBirthTimeTouched] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [releasePreflightState, setReleasePreflightState] = useState<ReleasePreflightUiState>({
    status: 'idle',
    message: ''
  });
  const advanceTimerRef = useRef<number | null>(null);

  const scheduleStep = (nextStep: GeneralSignatureIntakeStep) => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      setStep(nextStep);
      advanceTimerRef.current = null;
    }, 220);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', {
        replace: true,
        state: { returnTo: '/form/general-signature', tabOrigin }
      });
    }
  }, [isAuthenticated, navigate, tabOrigin]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let draft: Partial<IntakeFormData> | null = null;
    const rawDraft = window.sessionStorage.getItem(GENERAL_SIGNATURE_DRAFT_KEY);
    if (rawDraft) {
      try {
        draft = JSON.parse(rawDraft) as Partial<IntakeFormData>;
      } catch {
        window.sessionStorage.removeItem(GENERAL_SIGNATURE_DRAFT_KEY);
      }
    }

    const source = locationState?.formData ?? draft;
    const hydrated = hydrateFormData(source);
    setFormData(hydrated);
    setBirthDigits(sanitizeDigits(hydrated.birthDate, 8));
    setBirthTimeInput(hydrated.isUnknownTime ? '' : hydrated.birthTime);
    setHasHydrated(true);
  }, [locationState?.formData]);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      GENERAL_SIGNATURE_DRAFT_KEY,
      JSON.stringify(normalizeIntakeFormData(formData))
    );
  }, [formData, hasHydrated]);

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const birthValidation = useMemo(
    () => validateBirthInput(formData, { subjectLabel: '본인' }),
    [formData]
  );
  const q1Ready = isGeneralSignatureQuestionReady(formData.q1);
  const q2Ready = isGeneralSignatureQuestionReady(formData.q2);
  const isQuestionStep = step === 'question-one' || step === 'question-two';

  const clearPreflight = () => {
    if (releasePreflightState.status !== 'idle') {
      setReleasePreflightState({ status: 'idle', message: '' });
    }
  };

  const updateField = <K extends keyof IntakeFormData>(key: K, value: IntakeFormData[K]) => {
    clearPreflight();
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const updateBirthDate = (value: string) => {
    const digits = sanitizeDigits(value, 8);
    const birthDate = normalizeBirthDate(digits, formData.calendar);
    setBirthDigits(digits);
    updateField('birthDate', birthDate);
    if (birthDate) scheduleStep('gender');
  };

  const updateBirthTime = (value: string, finalize = false) => {
    const parsed = parseTypedBirthTime(value, finalize);
    setBirthTimeInput(parsed.displayValue);
    setBirthTimeTouched(finalize || value.replace(/\D/g, '').length >= 4);
    setFormData((current) => ({
      ...current,
      birthTime: parsed.canonicalValue,
      isUnknownTime: false,
      birthTimePrecision: 'exact'
    }));
    if (parsed.canonicalValue && formData.location) scheduleStep('relationship');
  };

  const toggleUnknownTime = () => {
    clearPreflight();
    setFormData((current) => {
      const nextUnknown = !current.isUnknownTime;
      return {
        ...current,
        birthTime: nextUnknown ? '' : current.birthTime,
        isUnknownTime: nextUnknown,
        birthTimePrecision: nextUnknown ? 'unknown' : 'exact'
      };
    });
    setBirthTimeTouched(false);

    if (!formData.isUnknownTime) {
      setBirthTimeInput('');
      if (formData.location) scheduleStep('relationship');
    }
  };

  const updateBirthLocation = (label: string) => {
    clearPreflight();
    const selected = birthLocationOptions.find((option) => option.label === label);
    setFormData((current) => ({
      ...current,
      location: selected?.label ?? '',
      birthLocation:
        selected?.latitude === undefined || selected.longitude === undefined
          ? undefined
          : {
              label: selected.label,
              latitude: selected.latitude,
              longitude: selected.longitude,
              timezone: 'Asia/Seoul',
              // No utcOffsetMinutes: the form cannot know which offset Korea used
              // at the customer's birth, and +09:00 is wrong for 1954-1961 and for
              // the 1987-1988 summer time. The calendar engine resolves it instead.
              applySolarTimeCorrection: true
            }
    }));

    if (selected && (formData.isUnknownTime || Boolean(formData.birthTime))) {
      scheduleStep('relationship');
    }
  };

  const selectCalendar = (calendar: IntakeFormData['calendar'], isLeapMonth = false) => {
    clearPreflight();
    const birthDate = normalizeBirthDate(birthDigits, calendar);
    setFormData((current) => ({ ...current, calendar, isLeapMonth, birthDate }));
    if (birthDate) scheduleStep('gender');
  };

  const selectGender = (gender: Exclude<IntakeFormData['gender'], ''>) => {
    updateField('gender', gender);
    scheduleStep('birth-time-location');
  };

  const selectRelationshipStatus = (relationshipStatus: Exclude<RelationshipStatus, ''>) => {
    clearPreflight();
    setFormData((current) => ({ ...current, relationshipStatus, relationshipDuration: '' }));
  };

  const selectRelationshipDuration = (relationshipDuration: IntakeFormData['relationshipDuration']) => {
    updateField('relationshipDuration', relationshipDuration);
    scheduleStep('question-one');
  };

  const isStepReady = (() => {
    switch (step) {
      case 'name':
        return Boolean(formData.name.trim());
      case 'birth-date':
        return birthDigits.length === 8 && Boolean(formData.birthDate);
      case 'gender':
        return isGeneralSignatureGenderSelected(formData.gender);
      case 'birth-time-location':
        return birthValidation.valid && Boolean(formData.location);
      case 'relationship':
        return isGeneralSignatureRelationshipReady(
          formData.relationshipStatus,
          formData.relationshipDuration
        );
      case 'question-one':
        return q1Ready;
      case 'question-two':
        return q2Ready && birthValidation.valid;
    }
  })();

  const submitForm = async () => {
    if (
      !service || !birthValidation.valid || !q1Ready || !q2Ready ||
      !isGeneralSignatureGenderSelected(formData.gender) ||
      !isGeneralSignatureRelationshipReady(formData.relationshipStatus, formData.relationshipDuration) ||
      releasePreflightState.status === 'checking'
    ) return;

    const submittedFormData = normalizeIntakeFormData(formData);
    window.sessionStorage.setItem(GENERAL_SIGNATURE_DRAFT_KEY, JSON.stringify(submittedFormData));

    if (locationState?.recoveredEntitlement) {
      navigate('/loading', {
        state: {
          product: service.id,
          formData: submittedFormData,
          paymentMethod: 'portone',
          orderId: locationState.recoveredEntitlement.orderId,
          reportAccessToken: locationState.recoveredEntitlement.reportAccessToken,
          tabOrigin
        }
      });
      return;
    }

    setReleasePreflightState({
      status: 'checking',
      message: '정확한 자동 분석이 가능한 명식인지 확인하고 있습니다.'
    });

    try {
      const preflight = await requestGeneralSignatureReleasePreflight(submittedFormData);
      if (preflight.status === 'manual-review-required') {
        const continueLocalPreview = canContinueManualReviewInLocalPreview(preflight.status, {
          isDevelopment: import.meta.env.DEV,
          hostname: window.location.hostname
        });

        if (!continueLocalPreview) {
          setReleasePreflightState({
            status: 'manual-review-required',
            message: '이 명식은 자동 해석보다 추가 검토가 필요합니다.'
          });
          return;
        }

        console.info('[report-flow] local preview continuing after server manual-review decision', {
          serviceId: SERVICE_ID,
          eligibility: preflight.status
        });
      }
      if (preflight.status === 'blocked') {
        setReleasePreflightState({
          status: 'blocked',
          message: '현재 입력으로는 정확한 자동 분석을 진행하기 어렵습니다.'
        });
        return;
      }
    } catch (error) {
      setReleasePreflightState({
        status: 'error',
        message: error instanceof Error
          ? error.message
          : '종합사주 자동 발행 가능 여부를 확인하지 못했습니다.'
      });
      return;
    }

    setReleasePreflightState({ status: 'idle', message: '' });
    navigate('/checkout', {
      state: { product: service.id, formData: submittedFormData, tabOrigin }
    });
  };

  const handleNext = () => {
    if (!isStepReady) return;
    const nextStep = getNextGeneralSignatureStep(step);
    if (nextStep) setStep(nextStep);
    else void submitForm();
  };

  if (!isAuthenticated) return null;

  return (
    <main className={`gs-intake-page ${isQuestionStep ? 'is-question-step' : 'is-profile-step'}`}>
      <video
        className="gs-intake-video"
        src={VIDEO_SOURCE}
        poster="/home-general-saju-premium-cover-600.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        onCanPlay={(event) => void event.currentTarget.play().catch(() => undefined)}
      />
      <span className="gs-intake-video-shade" aria-hidden="true" />

      <section className="gs-intake-panel" aria-labelledby="gs-intake-step-title">
        <div className="gs-intake-step" key={step} aria-live="polite">
          {step === 'name' ? (
            <label className="gs-intake-field">
              <span id="gs-intake-step-title">성함은?</span>
              <input
                autoFocus
                type="text"
                value={formData.name}
                maxLength={12}
                enterKeyHint="next"
                onChange={(event) => updateField('name', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing && formData.name.trim()) {
                    event.preventDefault();
                    scheduleStep('birth-date');
                  }
                }}
                placeholder="예: 김운월"
              />
            </label>
          ) : null}

          {step === 'birth-date' ? (
            <div className="gs-intake-field">
              <span id="gs-intake-step-title">생년월일 알려줘</span>
              <div className="gs-intake-choice-row" role="group" aria-label="달력 구분">
                <button type="button" className={formData.calendar === 'solar' ? 'active' : ''} onClick={() => selectCalendar('solar')}>양력</button>
                <button type="button" className={formData.calendar === 'lunar' && !formData.isLeapMonth ? 'active' : ''} onClick={() => selectCalendar('lunar')}>음력</button>
                <button type="button" className={formData.calendar === 'lunar' && formData.isLeapMonth ? 'active' : ''} aria-pressed={formData.calendar === 'lunar' && formData.isLeapMonth} onClick={() => selectCalendar('lunar', true)}>윤달</button>
              </div>
              <input autoFocus type="text" inputMode="numeric" aria-label="생년월일 8자리" value={formatBirthDateInput(birthDigits)} maxLength={10} onChange={(event) => updateBirthDate(event.target.value)} placeholder="2000.01.01" />
              {birthDigits.length === 8 && !formData.birthDate ? <small className="gs-intake-inline-error">생년월일을 다시 확인해 주세요.</small> : null}
            </div>
          ) : null}

          {step === 'gender' ? (
            <div className="gs-intake-field">
              <span id="gs-intake-step-title">성별은?</span>
              <div className="gs-intake-large-choices" role="group" aria-label="성별 선택">
                {(['male', 'female'] as const).map((gender) => (
                  <button key={gender} type="button" className={formData.gender === gender ? 'active' : ''} aria-pressed={formData.gender === gender} onClick={() => selectGender(gender)}>
                    {gender === 'male' ? '남자' : '여자'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'birth-time-location' ? (
            <div className="gs-intake-field">
              <span id="gs-intake-step-title">태어난 시간은?</span>
              <div className="gs-intake-time-row">
                <input autoFocus type="text" inputMode="numeric" value={birthTimeInput} disabled={formData.isUnknownTime} maxLength={5} onChange={(event) => updateBirthTime(event.target.value)} onBlur={(event) => updateBirthTime(event.target.value, true)} placeholder="예: 10:24" aria-label="태어난 시간" />
                <button type="button" className={formData.isUnknownTime ? 'active' : ''} aria-pressed={formData.isUnknownTime} onClick={toggleUnknownTime}>
                  <Check size={15} aria-hidden="true" /> 시간 모름
                </button>
              </div>
              {birthTimeTouched && !formData.isUnknownTime && !formData.birthTime ? <small className="gs-intake-inline-error">시간을 24시간 형식으로 확인해 주세요.</small> : null}
              <label className="gs-intake-select">
                <span>출생지역</span>
                <select value={formData.birthLocation?.label || formData.location || ''} onChange={(event) => updateBirthLocation(event.target.value)}>
                  <option value="" disabled>출생지역 선택</option>
                  {birthLocationOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                </select>
                <ChevronDown size={17} aria-hidden="true" />
              </label>
            </div>
          ) : null}

          {step === 'relationship' ? (
            <div className="gs-intake-field">
              <span id="gs-intake-step-title">지금 연애 상태는?</span>
              <div className="gs-intake-large-choices relationship" role="group" aria-label="현재 관계 상태">
                {relationshipStatusOptions.map((option) => (
                  <button key={option.value} type="button" className={formData.relationshipStatus === option.value ? 'active' : ''} aria-pressed={formData.relationshipStatus === option.value} onClick={() => selectRelationshipStatus(option.value)}>{option.label}</button>
                ))}
              </div>
              {formData.relationshipStatus ? (
                <div className="gs-intake-duration-block">
                  <span>{formData.relationshipStatus === 'single' ? '마지막 연애 이후 얼마나 지났나요?' : '이 상태가 이어진 기간은?'}</span>
                  <div className="gs-intake-duration-choices" role="group" aria-label="현재 상태 기간">
                    {relationshipDurationOptions.map((option) => (
                      <button key={option.value} type="button" className={formData.relationshipDuration === option.value ? 'active' : ''} aria-pressed={formData.relationshipDuration === option.value} onClick={() => selectRelationshipDuration(option.value)}>{option.label}</button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 'question-one' || step === 'question-two' ? (
            <label className="gs-intake-field">
              <span id="gs-intake-step-title">{step === 'question-one' ? '첫 번째로 궁금한 건?' : '두 번째로 궁금한 건?'}</span>
              <textarea
                autoFocus
                value={step === 'question-one' ? formData.q1 : formData.q2}
                minLength={GENERAL_SIGNATURE_QUESTION_MIN_LENGTH}
                maxLength={180}
                enterKeyHint={step === 'question-one' ? 'next' : 'done'}
                onChange={(event) => updateField(step === 'question-one' ? 'q1' : 'q2', event.target.value)}
                placeholder={step === 'question-one' ? '예: 앞으로 돈을 안정적으로 남기려면 무엇을 가장 주의해야 하나요?' : '예: 지금 제게 맞는 직업 방향과 움직이기 좋은 시기는 언제인가요?'}
              />
              <div className="gs-intake-question-meta"><span>{(step === 'question-one' ? formData.q1 : formData.q2).trim().length}/{GENERAL_SIGNATURE_QUESTION_MIN_LENGTH}</span></div>
              <button type="button" className="gs-intake-question-action" disabled={!isStepReady || releasePreflightState.status === 'checking'} onClick={handleNext}>
                {step === 'question-one' ? '두 번째 질문 쓰기' : releasePreflightState.status === 'checking' ? '분석 가능 여부 확인 중…' : '내 종합사주 분석하기'}
              </button>
              {step === 'question-two' && releasePreflightState.message ? (
                <p className={`gs-intake-preflight is-${releasePreflightState.status}`} role={releasePreflightState.status === 'checking' ? 'status' : 'alert'} aria-live="polite">{releasePreflightState.message}</p>
              ) : null}
            </label>
          ) : null}
        </div>
      </section>
    </main>
  );
}
