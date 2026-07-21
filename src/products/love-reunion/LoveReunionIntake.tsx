import { ArrowLeft, Check, ChevronRight, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
      reunionContext: { ...previous.reunionContext, partnerBirthKnown: known }
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
          context.breakupReason &&
          context.reunionReason.trim() &&
          (context.breakupReason !== 'other' || context.breakupReasonDetail.trim())
      );
    }
    if (targetStep === 4) return !context.partnerBirthKnown || Boolean(partnerValidation?.valid);
    return Boolean(formData.q1.trim() && formData.q2.trim());
  };

  const explainStepError = () => {
    if (step === 1) return selfValidation.errors[0]?.message || '본인 출생 정보를 확인해 주세요.';
    if (step === 2) return '관계 상태, 교제 기간, 이별 후 경과, 마지막 연락을 모두 선택해 주세요.';
    if (step === 3) return '현재 연락 상태와 이별 이유, 재회를 바라는 이유를 확인해 주세요.';
    if (step === 4) return partnerValidation?.errors[0]?.message || '상대방 출생 정보를 확인해 주세요.';
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

  const handleNext = () => {
    if (!isStepReady(step)) {
      setError(explainStepError());
      return;
    }

    if (step === 5) {
      completeIntake();
      return;
    }

    setStep((previous) => (previous + 1) as IntakeStep);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (step === 1) {
      navigate(tabOrigin);
      return;
    }

    setStep((previous) => (previous - 1) as IntakeStep);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      <div className="love-reunion-intake__progress" aria-label={`전체 5단계 중 ${step}단계`}>
        <span style={{ width: `${step * 20}%` }} />
      </div>

      <section className="love-reunion-intake__hero">
        <span>REUNION NOTE · {step}/5</span>
        <h1>
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
                    onClick={() => updateContext('relationshipState', option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
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
                    onClick={() => updateContext('currentContact', option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
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

            {formData.reunionContext.currentContact === 'blocked' ? (
              <aside className="love-reunion-intake__safety">
                <ShieldCheck size={20} />
                <div>
                  <strong>차단이나 연락 거절은 반드시 존중해야 합니다.</strong>
                  <p>리포트도 우회 연락을 권하지 않으며, 회복과 경계 지키기를 우선으로 안내합니다.</p>
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
                >
                  몰라도 진행
                </button>
                <button
                  type="button"
                  className={formData.reunionContext.partnerBirthKnown ? 'active' : undefined}
                  onClick={() => setPartnerBirthKnown(true)}
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
                  onChange={(event) => updateField(key, event.target.value.slice(0, LOVE_REUNION_TEXT_LIMITS.question))}
                  placeholder={index === 0 ? '예: 지금 연락을 시도해도 되는 현실 조건은 무엇인가요?' : '예: 다시 만난다면 꼭 바꿔야 할 제 패턴은 무엇인가요?'}
                />
                <small>{formData[key].length}/{LOVE_REUNION_TEXT_LIMITS.question}</small>
              </label>
            ))}

            <div className="love-reunion-intake__suggestions" aria-label="질문 예시">
              {questionSuggestions.map((question, index) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => updateField(formData.q1.trim() && !formData.q2.trim() ? 'q2' : index % 2 === 0 ? 'q1' : 'q2', question)}
                >
                  {question}
                </button>
              ))}
            </div>

            <article className="love-reunion-intake__review">
              <span>입력 요약</span>
              <strong>{formatBirthSummary(formData)}</strong>
              <p>상대 출생정보: {formData.reunionContext.partnerBirthKnown ? '입력함' : '모름 · 진행 가능'}</p>
              <p>질문 두 개와 관계 맥락은 결제 후 재회운 리포트에 함께 보관됩니다.</p>
            </article>

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
