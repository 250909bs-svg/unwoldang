import { ArrowLeft, Check, ChevronRight, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { IntakeFormData, PartnerBirthData } from '../../api/mockData';
import { useAuth } from '../../context/AuthContext';
import { validateBirthInput } from '../../lib/birthInputValidation';
import { loveReunionProduct } from './index';
import {
  LOVE_REUNION_CHECKOUT_INTENT_KEY,
  LOVE_REUNION_DRAFT_KEY,
  LOVE_REUNION_TEXT_LIMITS,
  createEmptyLoveReunionFormData,
  hydrateLoveReunionFormData,
  prepareLoveReunionCheckoutFormData,
  validateLoveReunionFormData,
  type LoveReunionContext,
  type LoveReunionFormData
} from './contract';
import './intake.css';

type IntakeStep = 1 | 2 | 3 | 4 | 5;
type ContactSafetyAnswer = '' | 'none' | 'explicit-no-contact' | 'safety-risk';
type QuestionKey = 'q1' | 'q2';

type LoveReunionIntakeLocationState = {
  formData?: Partial<LoveReunionFormData>;
  tabOrigin?: string;
  draftOwnerId?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

const relationshipStateOptions = [
  { value: 'separated-no-contact', label: '이별 후 연락 없음', description: '현재 서로 연락하지 않고 있어요.' },
  { value: 'separated-contacting', label: '이별 후 연락 중', description: '안부나 감정 대화가 이어지고 있어요.' },
  { value: 'ambiguous', label: '관계가 애매함', description: '헤어졌지만 관계 정의가 분명하지 않아요.' },
  { value: 'reconnecting', label: '다시 알아가는 중', description: '재회 결론 없이 천천히 대화 중이에요.' },
  { value: 'closure', label: '정리도 고민 중', description: '재회와 회복 중 어느 쪽이 나은지 보고 싶어요.' }
] as const;

const relationshipLengthOptions = [
  { value: 'under-3-months', label: '3개월 미만' },
  { value: '3-to-12-months', label: '3개월~1년' },
  { value: '1-to-3-years', label: '1~3년' },
  { value: '3-to-5-years', label: '3~5년' },
  { value: 'over-5-years', label: '5년 이상' }
] as const;

const breakupElapsedOptions = [
  { value: 'under-1-week', label: '1주 미만' },
  { value: '1-to-4-weeks', label: '1주~1개월' },
  { value: '1-to-3-months', label: '1~3개월' },
  { value: '3-to-6-months', label: '3~6개월' },
  { value: 'over-6-months', label: '6개월 이상' }
] as const;

const lastContactTimingOptions = [
  { value: 'today', label: '오늘' },
  { value: 'under-1-week', label: '1주 이내' },
  { value: 'under-1-month', label: '1개월 이내' },
  { value: '1-to-3-months', label: '1~3개월 전' },
  { value: 'over-3-months', label: '3개월 이상' },
  { value: 'never', label: '이별 후 연락 없음' },
  { value: 'unknown', label: '기억나지 않음' }
] as const;

const currentContactOptions = [
  { value: 'none', label: '연락 없음', description: '서로 연락하지 않는 상태' },
  { value: 'blocked', label: '차단·연락 거절', description: '연락하지 말라는 의사나 차단이 확인됨' },
  { value: 'practical-only', label: '용건만 연락', description: '물건·정산 등 필요한 대화만 함' },
  { value: 'occasional', label: '가끔 안부', description: '간헐적으로 짧은 안부를 주고받음' },
  { value: 'friendly', label: '편하게 연락', description: '친구처럼 대화가 이어지는 편' },
  { value: 'reconnecting', label: '재접촉 중', description: '다시 만남을 전제로 천천히 확인 중' }
] as const;

const contactBoundaryOptions = [
  {
    value: 'none',
    label: '거절·안전 우려 없음',
    description: '명시적인 연락 거절이나 폭력·위협·스토킹 우려가 없어요.'
  },
  {
    value: 'explicit-no-contact',
    label: '연락하지 말라는 의사 확인',
    description: '차단 또는 연락하지 말라는 요청을 분명히 확인했어요.'
  },
  {
    value: 'safety-risk',
    label: '폭력·위협 등 안전 우려 있음',
    description: '폭력, 협박, 스토킹 또는 신변 안전 우려가 있었어요.'
  }
] as const;

const breakupReasonOptions = [
  { value: 'communication', label: '소통 부족·회피' },
  { value: 'trust', label: '신뢰 문제' },
  { value: 'distance', label: '장거리·환경 변화' },
  { value: 'timing', label: '일·학업·가족 등 시기 문제' },
  { value: 'conflict', label: '반복되는 다툼' },
  { value: 'values', label: '가치관·미래 방향 차이' },
  { value: 'other', label: '그 밖의 이유' }
] as const;

const questionSuggestions = [
  '지금 연락을 시도해도 되는 현실 조건은 무엇인가요?',
  '제가 반복하지 말아야 할 관계 패턴은 무엇인가요?',
  '재회보다 회복을 선택해야 하는 신호는 무엇인가요?',
  '다시 만난다면 꼭 합의해야 할 기준은 무엇인가요?'
] as const;

const intakeStepMeta: Record<IntakeStep, { name: string; estimate: string; remaining: string }> = {
  1: { name: '본인 정보', estimate: '약 1분', remaining: '4단계 남음' },
  2: { name: '관계 상황', estimate: '약 1분', remaining: '3단계 남음' },
  3: { name: '이별 맥락', estimate: '약 1분', remaining: '2단계 남음' },
  4: { name: '상대 정보', estimate: '약 30초', remaining: '1단계 남음' },
  5: { name: '질문과 최종 검토', estimate: '약 1분', remaining: '마지막 단계' }
};

const emptyPartner: PartnerBirthData = {
  name: '상대방',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: true,
  birthTimePrecision: 'unknown',
  dayBoundaryPolicy: 'midnight'
};

const CHECKOUT_INTENT_TTL_MS = 30 * 60 * 1000;

function clearStoredDraft() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(LOVE_REUNION_DRAFT_KEY);
  window.sessionStorage.removeItem(LOVE_REUNION_CHECKOUT_INTENT_KEY);
}

function hasFreshCheckoutIntent() {
  if (typeof window === 'undefined') {
    return false;
  }

  const issuedAt = Date.parse(window.sessionStorage.getItem(LOVE_REUNION_CHECKOUT_INTENT_KEY) || '');
  const now = Date.now();
  const isFresh = Number.isFinite(issuedAt) && issuedAt <= now && now - issuedAt <= CHECKOUT_INTENT_TTL_MS;

  if (!isFresh) {
    clearStoredDraft();
  }

  return isFresh;
}

function readStoredDraft(source?: Partial<LoveReunionFormData>) {
  if (source) {
    return hydrateLoveReunionFormData(source);
  }

  if (typeof window === 'undefined' || !hasFreshCheckoutIntent()) {
    return createEmptyLoveReunionFormData();
  }

  const raw = window.sessionStorage.getItem(LOVE_REUNION_DRAFT_KEY);

  if (!raw) {
    clearStoredDraft();
    return createEmptyLoveReunionFormData();
  }

  try {
    return hydrateLoveReunionFormData(JSON.parse(raw) as Partial<LoveReunionFormData>);
  } catch {
    clearStoredDraft();
    return createEmptyLoveReunionFormData();
  }
}

function formatBirthSummary(formData: LoveReunionFormData) {
  const calendar = formData.calendar === 'lunar' ? (formData.isLeapMonth ? '음력 윤달' : '음력') : '양력';
  const time = formData.isUnknownTime ? '시간 미상' : formData.birthTime || '시간 미입력';
  return `${formData.birthDate || '생년월일 미입력'} · ${time} · ${calendar}`;
}


function getOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string
) {
  return options.find((option) => option.value === value)?.label || '미선택';
}

export default function LoveReunionIntake() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const locationState = (location.state as LoveReunionIntakeLocationState | null) ?? null;
  const ownsLocationDraft = !locationState?.draftOwnerId || locationState.draftOwnerId === user?.id;
  const [formData, setFormData] = useState(() =>
    readStoredDraft(ownsLocationDraft ? locationState?.formData : undefined)
  );
  const [step, setStep] = useState<IntakeStep>(1);
  const [error, setError] = useState('');
  const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);
  const [boundaryAcknowledged, setBoundaryAcknowledged] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const questionInputRefs = useRef<Record<QuestionKey, HTMLTextAreaElement | null>>({
    q1: null,
    q2: null
  });
  const isFirstStepRenderRef = useRef(true);
  const stepMeta = intakeStepMeta[step];
  const tabOrigin = locationState?.tabOrigin || loveReunionProduct.routes.detail;
  const selfValidation = useMemo(
    () => validateBirthInput(formData, { subjectLabel: '본인' }),
    [formData]
  );
  const partnerValidation = useMemo(
    () =>
      formData.reunionContext.partnerBirthKnown && formData.partner
        ? validateBirthInput(formData.partner, { subjectLabel: '상대방' })
        : null,
    [formData.partner, formData.reunionContext.partnerBirthKnown]
  );


  const preparedFormData = useMemo(() => prepareLoveReunionCheckoutFormData(formData), [formData]);

  useEffect(() => {
    if (isFirstStepRenderRef.current) {
      isFirstStepRenderRef.current = false;
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const focusFrame = window.requestAnimationFrame(() => {
      stepHeadingRef.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [step]);

  useEffect(() => {
    if (!isAuthenticated || !window.sessionStorage.getItem(LOVE_REUNION_CHECKOUT_INTENT_KEY)) {
      return;
    }

    const validation = validateLoveReunionFormData(preparedFormData);
    clearStoredDraft();

    if (!validation.valid) {
      setError(validation.errors[0] || '입력 내용을 다시 확인해 주세요.');
      return;
    }

    navigate(loveReunionProduct.routes.checkout, {
      replace: true,
      state: {
        product: loveReunionProduct.id,
        formData: preparedFormData,
        tabOrigin,
        draftOwnerId: user?.id
      }
    });
  }, [isAuthenticated, navigate, preparedFormData, tabOrigin, user?.id]);

  const updateField = <K extends keyof IntakeFormData>(key: K, value: IntakeFormData[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
    setError('');
  };

  const updateContext = <K extends keyof LoveReunionContext>(
    key: K,
    value: LoveReunionContext[K]
  ) => {
    setFormData((previous) => ({
      ...previous,
      reunionContext: { ...previous.reunionContext, [key]: value }
    }));
    setError('');
  };

  const updatePartner = <K extends keyof PartnerBirthData>(key: K, value: PartnerBirthData[K]) => {
    setFormData((previous) => ({
      ...previous,
      partner: { ...emptyPartner, ...previous.partner, [key]: value }
    }));
    setError('');
  };

  const setPartnerBirthKnown = (known: boolean) => {
    setFormData((previous) => ({
      ...previous,
      partner: known ? { ...emptyPartner, ...previous.partner } : undefined,
      reunionContext: {
        ...previous.reunionContext,
        partnerBirthKnown: known,
        partnerDataPermissionConfirmed:
          known ? previous.reunionContext.partnerDataPermissionConfirmed : false
      }
    }));
    setError('');
  };

  const isStepReady = (targetStep: IntakeStep) => {
    const context = formData.reunionContext;

    if (targetStep === 1) return selfValidation.valid;
    if (targetStep === 2) {
      return Boolean(
        context.relationshipState &&
          context.relationshipLength &&
          context.breakupElapsed &&
          context.lastContactTiming
      );
    }
    if (targetStep === 3) {
      return Boolean(
        context.currentContact &&
          context.contactBoundary &&
          (context.contactBoundary === 'none' || boundaryAcknowledged) &&
          context.breakupReason &&
          context.reunionReason.trim() &&
          (context.breakupReason !== 'other' || context.breakupReasonDetail.trim())
      );
    }
    if (targetStep === 4) {
      return !context.partnerBirthKnown || Boolean(partnerValidation?.valid && context.partnerDataPermissionConfirmed);
    }
    return Boolean(formData.q1.trim() && formData.q2.trim());
  };

  const explainStepError = () => {
    if (step === 1) return selfValidation.errors[0]?.message || '본인 출생 정보를 확인해 주세요.';
    if (step === 2) return '관계 상태, 교제 기간, 이별 후 경과, 마지막 연락을 모두 선택해 주세요.';
    if (step === 3) {
      if (!formData.reunionContext.contactBoundary) return '연락 거절 또는 안전 우려 여부를 선택해 주세요.';
      if (formData.reunionContext.contactBoundary !== 'none' && !boundaryAcknowledged) return '접촉보다 경계·안전을 우선한다는 안내를 확인해 주세요.';
      return '현재 연락 상태와 이별 이유, 재회를 바라는 이유를 확인해 주세요.';
    }
    if (step === 4) {
      if (formData.reunionContext.partnerBirthKnown && !formData.reunionContext.partnerDataPermissionConfirmed) return '상대방 출생정보의 제공·분석 권한을 확인해 주세요.';
      return partnerValidation?.errors[0]?.message || '상대방 출생 정보를 확인해 주세요.';
    }
    return '질문 두 가지를 모두 입력해 주세요.';
  };

  const completeIntake = () => {
    const validation = validateLoveReunionFormData(preparedFormData);

    if (!validation.valid) {
      setError(validation.errors[0] || '입력 내용을 다시 확인해 주세요.');
      return;
    }

    if (!isAuthenticated) {
      window.sessionStorage.setItem(LOVE_REUNION_DRAFT_KEY, JSON.stringify(preparedFormData));
      window.sessionStorage.setItem(LOVE_REUNION_CHECKOUT_INTENT_KEY, new Date().toISOString());
      navigate('/login', {
        state: { returnTo: loveReunionProduct.routes.intake, tabOrigin }
      });
      return;
    }

    clearStoredDraft();
    if (locationState?.recoveredEntitlement) {
      navigate(loveReunionProduct.routes.loading, {
        state: {
          product: loveReunionProduct.id,
          formData: preparedFormData,
          paymentMethod: 'portone',
          orderId: locationState.recoveredEntitlement.orderId,
          reportAccessToken: locationState.recoveredEntitlement.reportAccessToken,
          tabOrigin
        }
      });
      return;
    }

    navigate(loveReunionProduct.routes.checkout, {
      state: {
        product: loveReunionProduct.id,
        formData: preparedFormData,
        tabOrigin,
        draftOwnerId: user?.id
      }
    });
  };

  const goToStep = (targetStep: IntakeStep) => {
    setStep(targetStep);
    setError('');
  };

  const handleContactBoundaryChange = (value: ContactSafetyAnswer) => {
    updateContext('contactBoundary', value);
    setBoundaryAcknowledged(false);
  };

  const focusQuestion = (key: QuestionKey) => {
    window.requestAnimationFrame(() => questionInputRefs.current[key]?.focus());
  };

  const handleQuestionSuggestion = (question: string) => {
    if (!formData.q1.trim()) {
      updateField('q1', question);
      focusQuestion('q1');
      return;
    }

    if (!formData.q2.trim()) {
      updateField('q2', question);
      focusQuestion('q2');
      return;
    }

    setPendingSuggestion(question);
  };

  const confirmQuestionReplacement = (key: QuestionKey) => {
    if (!pendingSuggestion) return;

    updateField(key, pendingSuggestion);
    setPendingSuggestion(null);
    focusQuestion(key);
  };

  const handleNext = () => {
    if (!isStepReady(step)) {
      setError(explainStepError());
      return;
    }

    if (step === 5) {
      completeIntake();
      return;
    }

    goToStep((step + 1) as IntakeStep);
  };

  const handleBack = () => {
    if (step === 1) {
      navigate(tabOrigin);
      return;
    }

    goToStep((step - 1) as IntakeStep);
  };

  return (
    <main className="love-reunion-intake">
      <header className="love-reunion-intake__topbar">
        <button type="button" onClick={handleBack} aria-label="이전 단계">
          <ArrowLeft size={19} />
        </button>
        <Link to="/" className="love-reunion-intake__brand">운월당</Link>
        <Link to="/my" aria-label="마이페이지">
          <UserRound size={18} />
        </Link>
      </header>

      <div
        className="love-reunion-intake__progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={step}
        aria-valuetext={`${stepMeta.name}, ${stepMeta.remaining}`}
      >
        <span style={{ width: `${step * 20}%` }} />
      </div>

      <section className="love-reunion-intake__hero">
        <span>REUNION NOTE · {step}/5 · {stepMeta.name}</span>
        <div className="love-reunion-intake__step-status" aria-live="polite">
          <strong>{stepMeta.estimate}</strong>
          <span>{stepMeta.remaining}</span>
        </div>
        <h1 ref={stepHeadingRef} tabIndex={-1}>
          {step === 1 && '나의 사주 기준을 먼저 맞춰요'}
          {step === 2 && '두 사람의 현재 거리를 알려주세요'}
          {step === 3 && '이별의 원인과 바라는 변화를 나눠요'}
          {step === 4 && '상대 출생정보는 몰라도 괜찮아요'}
          {step === 5 && '마지막으로 질문 두 가지를 적어주세요'}
        </h1>
        <p>
          {step === 1 && '시간을 모르면 시간 미상을 선택해도 진행할 수 있습니다.'}
          {step === 2 && '추측이 아니라 지금까지 실제로 있었던 연락과 관계 상태를 기준으로 봅니다.'}
          {step === 3 && '재회 자체보다 같은 문제가 달라질 수 있는지를 확인하는 데 사용합니다.'}
          {step === 4 && '알고 있을 때만 입력하며, 모르면 본인 사주와 현실 행동 신호로 분석합니다.'}
          {step === 5 && '상대 속마음 단정보다 내가 판단하고 행동할 수 있는 질문이 좋습니다.'}
        </p>
      </section>

      <section className="love-reunion-intake__panel">
        {step === 1 ? (
          <div className="love-reunion-intake__fields">
            <label>
              <span>이름 또는 호칭</span>
              <input
                value={formData.name}
                onChange={(event) =>
                  updateField('name', event.target.value.slice(0, LOVE_REUNION_TEXT_LIMITS.name))
                }
                placeholder="리포트에서 부를 이름"
                autoComplete="name"
              />
            </label>

            <fieldset>
              <legend>성별</legend>
              <div className="love-reunion-intake__segments">
                {(['female', 'male'] as const).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    className={formData.gender === gender ? 'active' : undefined}
                    aria-pressed={formData.gender === gender}
                    onClick={() => updateField('gender', gender)}
                  >
                    {gender === 'female' ? '여성' : '남성'}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>생년월일 기준</legend>
              <div className="love-reunion-intake__segments">
                {(['solar', 'lunar'] as const).map((calendar) => (
                  <button
                    key={calendar}
                    type="button"
                    className={formData.calendar === calendar ? 'active' : undefined}
                    aria-pressed={formData.calendar === calendar}
                    onClick={() => {
                      updateField('calendar', calendar);
                      if (calendar === 'solar') updateField('isLeapMonth', false);
                    }}
                  >
                    {calendar === 'solar' ? '양력' : '음력'}
                  </button>
                ))}
              </div>
              <label className="love-reunion-intake__check">
                <input
                  type="checkbox"
                  checked={formData.isLeapMonth}
                  disabled={formData.calendar !== 'lunar'}
                  onChange={(event) => updateField('isLeapMonth', event.target.checked)}
                />
                <span><Check size={13} /></span>
                음력 윤달
              </label>
            </fieldset>

            <label>
              <span>생년월일</span>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(event) => updateField('birthDate', event.target.value)}
              />
            </label>

            <label>
              <span>출생 시각</span>
              <input
                type="time"
                value={formData.isUnknownTime ? '' : formData.birthTime}
                disabled={formData.isUnknownTime}
                onChange={(event) => {
                  updateField('birthTime', event.target.value);
                  updateField('birthTimePrecision', 'exact');
                }}
              />
            </label>

            <label className="love-reunion-intake__check">
              <input
                type="checkbox"
                checked={formData.isUnknownTime}
                onChange={(event) => {
                  updateField('isUnknownTime', event.target.checked);
                  updateField('birthTime', '');
                  updateField('birthTimePrecision', event.target.checked ? 'unknown' : 'exact');
                }}
              />
              <span><Check size={13} /></span>
              태어난 시간을 몰라요
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="love-reunion-intake__fields">
            <fieldset>
              <legend>현재 관계 상태</legend>
              <div className="love-reunion-intake__choice-grid">
                {relationshipStateOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={formData.reunionContext.relationshipState === option.value ? 'active' : undefined}
                    aria-pressed={formData.reunionContext.relationshipState === option.value}
                    aria-describedby={`relationship-state-${option.value}-description`}
                    onClick={() => updateContext('relationshipState', option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span id={`relationship-state-${option.value}-description`}>{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              <span>교제 기간</span>
              <select
                value={formData.reunionContext.relationshipLength}
                onChange={(event) => updateContext('relationshipLength', event.target.value as LoveReunionContext['relationshipLength'])}
              >
                <option value="">선택해 주세요</option>
                {relationshipLengthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span>이별 후 경과</span>
              <select
                value={formData.reunionContext.breakupElapsed}
                onChange={(event) => updateContext('breakupElapsed', event.target.value as LoveReunionContext['breakupElapsed'])}
              >
                <option value="">선택해 주세요</option>
                {breakupElapsedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span>마지막 연락</span>
              <select
                value={formData.reunionContext.lastContactTiming}
                onChange={(event) => updateContext('lastContactTiming', event.target.value as LoveReunionContext['lastContactTiming'])}
              >
                <option value="">선택해 주세요</option>
                {lastContactTimingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span>마지막 연락 메모 <small>선택</small></span>
              <textarea
                value={formData.reunionContext.lastContactNote}
                onChange={(event) =>
                  updateContext('lastContactNote', event.target.value.slice(0, LOVE_REUNION_TEXT_LIMITS.lastContactNote))
                }
                placeholder="예: 안부를 묻고 짧게 답장이 왔어요. 날짜나 내용을 기억나는 만큼만 적어주세요."
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="love-reunion-intake__fields">
            <fieldset>
              <legend>현재 연락 여부</legend>
              <div className="love-reunion-intake__choice-grid compact">
                {currentContactOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={formData.reunionContext.currentContact === option.value ? 'active' : undefined}
                    aria-pressed={formData.reunionContext.currentContact === option.value}
                    aria-describedby={`current-contact-${option.value}-description`}
                    onClick={() => {
                      updateContext('currentContact', option.value);
                      if (option.value === 'blocked') handleContactBoundaryChange('explicit-no-contact');
                    }}
                  >
                    <strong>{option.label}</strong>
                    <span id={`current-contact-${option.value}-description`}>{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset aria-describedby="contact-boundary-help">
              <legend>연락 거절·안전 경계</legend>
              <p id="contact-boundary-help" className="love-reunion-intake__field-help">접촉 가능성을 판단하기 전에 명시적 거절과 폭력·위협 여부를 확인합니다.</p>
              <div className="love-reunion-intake__choice-grid compact">
                {contactBoundaryOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={formData.reunionContext.contactBoundary === option.value ? 'active' : undefined}
                    aria-pressed={formData.reunionContext.contactBoundary === option.value}
                    aria-describedby={`contact-boundary-${option.value}-description`}
                    onClick={() => handleContactBoundaryChange(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span id={`contact-boundary-${option.value}-description`}>{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              <span>주된 이별 이유</span>
              <select
                value={formData.reunionContext.breakupReason}
                onChange={(event) => updateContext('breakupReason', event.target.value as LoveReunionContext['breakupReason'])}
              >
                <option value="">선택해 주세요</option>
                {breakupReasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label>
              <span>이별 이유 상세 {formData.reunionContext.breakupReason === 'other' ? '' : <small>선택</small>}</span>
              <textarea
                value={formData.reunionContext.breakupReasonDetail}
                onChange={(event) =>
                  updateContext('breakupReasonDetail', event.target.value.slice(0, LOVE_REUNION_TEXT_LIMITS.breakupReasonDetail))
                }
                placeholder="누구의 잘못을 판정하기보다 반복된 장면과 달라져야 할 점을 적어주세요."
              />
            </label>

            <label>
              <span>재회를 생각하는 이유</span>
              <textarea
                value={formData.reunionContext.reunionReason}
                onChange={(event) => updateContext('reunionReason', event.target.value.slice(0, LOVE_REUNION_TEXT_LIMITS.reunionReason))}
                placeholder="그리움 외에 다시 만난다면 달라질 수 있다고 보는 현실적인 이유를 적어주세요."
              />
              <small>{formData.reunionContext.reunionReason.length}/{LOVE_REUNION_TEXT_LIMITS.reunionReason}</small>
            </label>

            {formData.reunionContext.contactBoundary && formData.reunionContext.contactBoundary !== 'none' ? (
              <aside id="contact-boundary-notice" className="love-reunion-intake__safety" role="note">
                <ShieldCheck size={20} />
                <div>
                  <strong>{formData.reunionContext.contactBoundary === 'safety-risk' ? '접촉보다 신변 안전이 먼저입니다.' : '연락 거절과 차단은 반드시 존중해야 합니다.'}</strong>
                  <p>이 경우 리포트는 접촉 방법을 제공하지 않고 회복·안전 계획만 안내합니다. {formData.reunionContext.contactBoundary === 'safety-risk' ? <>지금 위험하다면 <a href="tel:112">112</a>, 부상·응급 상황은 <a href="tel:119">119</a>, 여성긴급전화는 <a href="tel:1366">1366</a>에 도움을 요청하세요.</> : null}</p>
                  <label className="love-reunion-intake__check love-reunion-intake__safety-confirm">
                    <input
                      type="checkbox"
                      checked={boundaryAcknowledged}
                      onChange={(event) => setBoundaryAcknowledged(event.target.checked)}
                    />
                    <span><Check size={13} /></span>
                    접촉 시도보다 상대의 경계와 안전을 우선한다는 안내를 확인했습니다.
                  </label>
                </div>
              </aside>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="love-reunion-intake__fields">
            <fieldset>
              <legend>상대방 생년월일을 알고 있나요?</legend>
              <div className="love-reunion-intake__segments">
                <button
                  type="button"
                  className={!formData.reunionContext.partnerBirthKnown ? 'active' : undefined}
                  onClick={() => setPartnerBirthKnown(false)}
                  aria-pressed={!formData.reunionContext.partnerBirthKnown}
                >
                  몰라도 진행
                </button>
                <button
                  type="button"
                  className={formData.reunionContext.partnerBirthKnown ? 'active' : undefined}
                  onClick={() => setPartnerBirthKnown(true)}
                  aria-pressed={formData.reunionContext.partnerBirthKnown}
                >
                  알고 있어요
                </button>
              </div>
            </fieldset>

            {!formData.reunionContext.partnerBirthKnown ? (
              <aside className="love-reunion-intake__safety calm">
                <ShieldCheck size={20} />
                <div>
                  <strong>상대 정보 없이도 진행할 수 있어요.</strong>
                  <p>본인 사주 흐름과 입력한 관계 사실을 분리해 보고, 상대 부분은 실제 행동 신호로만 안내합니다.</p>
                </div>
              </aside>
            ) : (
              <>
                <fieldset>
                  <legend>상대방 성별</legend>
                  <div className="love-reunion-intake__segments">
                    {(['female', 'male'] as const).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        className={formData.partner?.gender === gender ? 'active' : undefined}
                        onClick={() => updatePartner('gender', gender)}
                        aria-pressed={formData.partner?.gender === gender}
                      >
                        {gender === 'female' ? '여성' : '남성'}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend>상대방 생년월일 기준</legend>
                  <div className="love-reunion-intake__segments">
                    {(['solar', 'lunar'] as const).map((calendar) => (
                      <button
                        key={calendar}
                        type="button"
                        className={formData.partner?.calendar === calendar ? 'active' : undefined}
                        aria-pressed={formData.partner?.calendar === calendar}
                        onClick={() => {
                          updatePartner('calendar', calendar);
                          if (calendar === 'solar') updatePartner('isLeapMonth', false);
                        }}
                      >
                        {calendar === 'solar' ? '양력' : '음력'}
                      </button>
                    ))}
                  </div>
                  <label className="love-reunion-intake__check">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.partner?.isLeapMonth)}
                      disabled={formData.partner?.calendar !== 'lunar'}
                      onChange={(event) => updatePartner('isLeapMonth', event.target.checked)}
                    />
                    <span><Check size={13} /></span>
                    음력 윤달
                  </label>
                </fieldset>

                <label>
                  <span>상대방 생년월일</span>
                  <input
                    type="date"
                    value={formData.partner?.birthDate || ''}
                    onChange={(event) => updatePartner('birthDate', event.target.value)}
                  />
                </label>

                <label>
                  <span>상대방 출생 시각</span>
                  <input
                    type="time"
                    value={formData.partner?.isUnknownTime ? '' : formData.partner?.birthTime || ''}
                    disabled={formData.partner?.isUnknownTime}
                    onChange={(event) => {
                      updatePartner('birthTime', event.target.value);
                      updatePartner('birthTimePrecision', 'exact');
                    }}
                  />
                </label>

                <label className="love-reunion-intake__check">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.partner?.isUnknownTime)}
                    onChange={(event) => {
                      updatePartner('isUnknownTime', event.target.checked);
                      updatePartner('birthTime', '');
                      updatePartner('birthTimePrecision', event.target.checked ? 'unknown' : 'exact');
                    }}
                  />
                  <span><Check size={13} /></span>
                  상대방 출생 시간을 몰라요
                </label>

                <label className="love-reunion-intake__check love-reunion-intake__permission-check">
                  <input
                    type="checkbox"
                    checked={formData.reunionContext.partnerDataPermissionConfirmed}
                    aria-describedby="partner-data-permission-help"
                    onChange={(event) => updateContext('partnerDataPermissionConfirmed', event.target.checked)}
                  />
                  <span><Check size={13} /></span>
                  상대방 정보를 제공하고 분석에 사용하는 데 필요한 권한을 확인했습니다.
                </label>
                <p id="partner-data-permission-help" className="love-reunion-intake__field-help">동의나 정당한 권한 없이 취득한 개인정보는 입력하지 마세요.</p>
              </>
            )}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="love-reunion-intake__fields">
            {(['q1', 'q2'] as const).map((key, index) => (
              <label key={key}>
                <span>질문 {index + 1}</span>
                <textarea
                  value={formData[key]}
                  ref={(element) => {
                    questionInputRefs.current[key] = element;
                  }}
                  onChange={(event) => updateField(key, event.target.value.slice(0, LOVE_REUNION_TEXT_LIMITS.question))}
                  placeholder={index === 0 ? '예: 지금 연락을 시도해도 되는 현실 조건은 무엇인가요?' : '예: 다시 만난다면 꼭 바꿔야 할 제 패턴은 무엇인가요?'}
                />
                <small>{formData[key].length}/{LOVE_REUNION_TEXT_LIMITS.question}</small>
              </label>
            ))}

            <div className="love-reunion-intake__suggestions" aria-label="질문 예시">
              {questionSuggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleQuestionSuggestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>

            {pendingSuggestion ? (
              <div className="love-reunion-intake__suggestion-confirm" role="status" aria-live="polite">
                <span>두 질문이 모두 작성되어 있어 자동으로 바꾸지 않았어요.</span>
                <strong>{pendingSuggestion}</strong>
                <div>
                  <button type="button" onClick={() => confirmQuestionReplacement('q1')}>질문 1 교체</button>
                  <button type="button" onClick={() => confirmQuestionReplacement('q2')}>질문 2 교체</button>
                  <button type="button" onClick={() => setPendingSuggestion(null)}>취소</button>
                </div>
              </div>
            ) : null}

            <article className="love-reunion-intake__review" aria-labelledby="love-reunion-review-title">
              <header>
                <div>
                  <span>FINAL REVIEW</span>
                  <h2 id="love-reunion-review-title">결제 전 입력 내용을 확인해 주세요</h2>
                </div>
                <strong>{formatBirthSummary(formData)}</strong>
              </header>
              <dl>
                <div>
                  <dt>관계 상태 · 교제 기간</dt>
                  <dd>{getOptionLabel(relationshipStateOptions, formData.reunionContext.relationshipState)} · {getOptionLabel(relationshipLengthOptions, formData.reunionContext.relationshipLength)}</dd>
                  <button type="button" onClick={() => goToStep(2)}>수정</button>
                </div>
                <div>
                  <dt>이별 후 경과</dt>
                  <dd>{getOptionLabel(breakupElapsedOptions, formData.reunionContext.breakupElapsed)}</dd>
                  <button type="button" onClick={() => goToStep(2)}>수정</button>
                </div>
                <div>
                  <dt>현재 연락 · 경계</dt>
                  <dd>{getOptionLabel(currentContactOptions, formData.reunionContext.currentContact)} · {getOptionLabel(contactBoundaryOptions, formData.reunionContext.contactBoundary)}</dd>
                  <button type="button" onClick={() => goToStep(3)}>수정</button>
                </div>
                <div>
                  <dt>이별 이유</dt>
                  <dd>{getOptionLabel(breakupReasonOptions, formData.reunionContext.breakupReason)}{formData.reunionContext.breakupReasonDetail ? ` · ${formData.reunionContext.breakupReasonDetail}` : ''}</dd>
                  <button type="button" onClick={() => goToStep(3)}>수정</button>
                </div>
                <div>
                  <dt>상대 출생정보</dt>
                  <dd>{formData.reunionContext.partnerBirthKnown ? '입력함 · 제공 권한 확인' : '입력하지 않음 · 진행 가능'}</dd>
                  <button type="button" onClick={() => goToStep(4)}>수정</button>
                </div>
                <div>
                  <dt>질문 1 원문</dt>
                  <dd>{formData.q1 || '미입력'}</dd>
                  <button type="button" onClick={() => focusQuestion('q1')}>바로 수정</button>
                </div>
                <div>
                  <dt>질문 2 원문</dt>
                  <dd>{formData.q2 || '미입력'}</dd>
                  <button type="button" onClick={() => focusQuestion('q2')}>바로 수정</button>
                </div>
              </dl>
            </article>

            <p className="love-reunion-intake__policy-links">
              입력 정보와 리포트는 다시보기·문의 대응을 위해 최대 1년 보관되며, 삭제를 요청할 수 있습니다.
              <Link to="/privacy"> 개인정보처리방침</Link>과
              <Link to="/refund"> 환불정책</Link>을 결제 전에 확인해 주세요.
            </p>

            <aside className="love-reunion-intake__safety calm">
              <ShieldCheck size={20} />
              <div>
                <strong>결과는 세 근거를 구분해서 보여줍니다.</strong>
                <p>사주 흐름, 사용자가 입력한 사실, 현실 행동 신호를 섞지 않으며 상대의 속마음·정확한 연락일·재회 성공을 확정하지 않습니다.</p>
              </div>
            </aside>
          </div>
        ) : null}

        {error ? <p className="love-reunion-intake__error" role="alert">{error}</p> : null}

        <footer className="love-reunion-intake__actions">
          <button type="button" className="secondary" onClick={handleBack}>이전</button>
          <button type="button" className="primary" onClick={handleNext}>
            {step === 5
              ? isAuthenticated
                ? `${loveReunionProduct.price.toLocaleString('ko-KR')}원 · 결제 확인`
                : '로그인하고 결제하기'
              : '다음으로'}
            <ChevronRight size={18} />
          </button>
        </footer>
      </section>
    </main>
  );
}
