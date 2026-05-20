import { Check, ChevronDown, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { type IntakeFormData, findServiceById } from '../api/mockData';
import { useAuth } from '../context/AuthContext';

const initialState: IntakeFormData = {
  name: '',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  relationshipStatus: '',
  relationshipDuration: '',
  location: '',
  q1: '',
  q2: ''
};

type IntakeStep = 1 | 2 | 3 | 4;

type FormLocationState = {
  formData?: Partial<IntakeFormData>;
  tabOrigin?: string;
};

const birthTimeOptions = [
  { value: 'unknown', label: '시간 모름', birthTime: '', unknown: true },
  { value: 'ja', label: '자/子 (00:00-01:29)', birthTime: '자/子 (00:00-01:29)' },
  { value: 'chuk', label: '축/丑 (01:30-03:29)', birthTime: '축/丑 (01:30-03:29)' },
  { value: 'in', label: '인/寅 (03:30-05:29)', birthTime: '인/寅 (03:30-05:29)' },
  { value: 'myo', label: '묘/卯 (05:30-07:29)', birthTime: '묘/卯 (05:30-07:29)' },
  { value: 'jin', label: '진/辰 (07:30-09:29)', birthTime: '진/辰 (07:30-09:29)' },
  { value: 'sa', label: '사/巳 (09:30-11:29)', birthTime: '사/巳 (09:30-11:29)' },
  { value: 'o', label: '오/午 (11:30-13:29)', birthTime: '오/午 (11:30-13:29)' },
  { value: 'mi', label: '미/未 (13:30-15:29)', birthTime: '미/未 (13:30-15:29)' },
  { value: 'sin', label: '신/申 (15:30-17:29)', birthTime: '신/申 (15:30-17:29)' },
  { value: 'yu', label: '유/酉 (17:30-19:29)', birthTime: '유/酉 (17:30-19:29)' },
  { value: 'sul', label: '술/戌 (19:30-21:29)', birthTime: '술/戌 (19:30-21:29)' },
  { value: 'hae', label: '해/亥 (21:30-23:29)', birthTime: '해/亥 (21:30-23:29)' },
  { value: 'yaja', label: '야자/夜子 (23:30-23:59)', birthTime: '야자/夜子 (23:30-23:59)' }
] as const;

const questionSuggestions = {
  q1: [
    '지금 제 인생에서 가장 먼저 정리해야 할 흐름은 무엇인가요?',
    '올해 가장 크게 들어오는 기회는 어느 쪽인가요?',
    '지금 조심해야 할 사람 관계나 선택이 있을까요?'
  ],
  q2: [
    '앞으로 3개월 안에 움직이면 좋은 시기는 언제인가요?',
    '연애운과 결혼운 중 지금 더 가까운 흐름은 무엇인가요?',
    '재물운과 직업운 중 어떤 쪽에 집중해야 하나요?'
  ]
} as const;

const relationshipStatusOptions = [
  { value: 'dating', label: '연애중', body: '현재 만나는 사람이 있어요.' },
  { value: 'single', label: '솔로', body: '현재는 혼자 흐름을 보고 싶어요.' },
  { value: 'married', label: '기혼', body: '결혼/배우자 흐름까지 함께 보고 싶어요.' }
] as const;

const relationshipDurationOptions = [
  { value: 'under1', label: '1년 미만' },
  { value: 'under3', label: '1년 이상 3년 이하' },
  { value: 'under5', label: '3년 이상 5년 이하' },
  { value: 'under10', label: '5년 이상 10년 이하' }
] as const;

const stepVisuals: Record<
  IntakeStep,
  {
    background: string;
  }
> = {
  1: {
    background: '/intake-night-blue.png'
  },
  2: {
    background: '/intake-blossom-girl.png'
  },
  3: {
    background: '/intake-beauty-red.png'
  },
  4: {
    background: '/intake-sunlight-girl.png'
  }
};

const yearlyStepVisuals: Record<
  IntakeStep,
  {
    background: string;
  }
> = {
  1: {
    background: '/intake-lantern-night.png'
  },
  2: {
    background: '/intake-night-blue.png'
  },
  3: {
    background: '/intake-sunlight-girl.png'
  },
  4: {
    background: '/intake-beauty-red.png'
  }
};

const sanitizeDigits = (value: string, maxLength: number) => value.replace(/\D/g, '').slice(0, maxLength);

const parseDateDigits = (birthDate?: string) => sanitizeDigits(birthDate?.replace(/\D/g, '') || '', 8);

const formatBirthDate = (digits: string) => {
  if (digits.length !== 8) {
    return '';
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  const probe = new Date(year, month - 1, day);

  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return '';
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const hydrateFormData = (source?: Partial<IntakeFormData> | null): IntakeFormData => ({
  ...initialState,
  ...source,
  name: source?.name ?? '',
  gender: source?.gender ?? 'female',
  calendar: source?.calendar ?? 'solar',
  isLeapMonth: Boolean(source?.isLeapMonth),
  birthDate: source?.birthDate ?? '',
  birthTime: source?.birthTime ?? '',
  isUnknownTime: Boolean(source?.isUnknownTime),
  relationshipStatus: source?.relationshipStatus ?? '',
  relationshipDuration: source?.relationshipDuration ?? '',
  location: source?.location ?? '',
  q1: source?.q1 ?? '',
  q2: source?.q2 ?? ''
});

function getBirthTimeSelectValue(formData: IntakeFormData) {
  if (formData.isUnknownTime) {
    return '';
  }

  return birthTimeOptions.find((option) => option.birthTime === formData.birthTime)?.value || '';
}

export default function Form() {
  const { id } = useParams<{ id: string }>();
  const service = findServiceById(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const locationState = (location.state as FormLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || '/';
  const draftKey = useMemo(() => `unwoldang.intake.${service.id}`, [service.id]);
  const [step, setStep] = useState<IntakeStep>(1);
  const [formData, setFormData] = useState<IntakeFormData>(initialState);
  const [birthDigits, setBirthDigits] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { returnTo: location.pathname, tabOrigin } });
    }
  }, [isAuthenticated, location.pathname, navigate, tabOrigin]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let draft: Partial<IntakeFormData> | null = null;
    const draftRaw = window.sessionStorage.getItem(draftKey);

    if (draftRaw) {
      try {
        draft = JSON.parse(draftRaw) as Partial<IntakeFormData>;
      } catch {
        window.sessionStorage.removeItem(draftKey);
      }
    }

    const hydrated = hydrateFormData(locationState?.formData ?? draft);

    setFormData(hydrated);
    setBirthDigits(parseDateDigits(hydrated.birthDate));
  }, [draftKey, locationState?.formData]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(draftKey, JSON.stringify(formData));
  }, [draftKey, formData]);

  const updateField = <K extends keyof IntakeFormData>(name: K, value: IntakeFormData[K]) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateBirthDate = (value: string) => {
    const nextDigits = sanitizeDigits(value, 8);
    setBirthDigits(nextDigits);
    updateField('birthDate', formatBirthDate(nextDigits));
  };

  const updateBirthTime = (nextValue: string) => {
    const selected = birthTimeOptions.find((option) => option.value === nextValue);

    if (!selected) {
      updateField('isUnknownTime', false);
      updateField('birthTime', '');
      return;
    }

    if (selected.value === 'unknown') {
      updateField('isUnknownTime', true);
      updateField('birthTime', '');
      return;
    }

    updateField('isUnknownTime', false);
    updateField('birthTime', selected.birthTime);
  };

  const toggleUnknownBirthTime = () => {
    setFormData((prev) => ({
      ...prev,
      isUnknownTime: !prev.isUnknownTime,
      birthTime: !prev.isUnknownTime ? '' : prev.birthTime
    }));
  };

  const toggleLeapMonth = () => {
    setFormData((prev) => {
      if (prev.calendar !== 'lunar') {
        return { ...prev, calendar: 'lunar', isLeapMonth: true };
      }

      return { ...prev, isLeapMonth: !prev.isLeapMonth };
    });
  };

  const birthDateReady = Boolean(formData.birthDate);
  const birthTimeReady = Boolean(formData.birthTime) || formData.isUnknownTime;
  const step1Ready =
    Boolean(formData.name.trim()) && Boolean(formData.gender) && birthDateReady && birthTimeReady;
  const step2Ready = Boolean(formData.relationshipStatus) && Boolean(formData.relationshipDuration);
  const step3Ready = Boolean(formData.q1.trim());
  const step4Ready = Boolean(formData.q2.trim());
  const canSubmit = step1Ready && step2Ready && step3Ready && step4Ready;
  const isYearlyFlow = false;
  const isLoveReadingFlow = false;
  const isCinematicFlow = true;
  const activeVisual = (isYearlyFlow ? yearlyStepVisuals : stepVisuals)[step];
  const _yearlySceneCopyDraft = {
    1: {
      kicker: 'YEARLY FLOW',
      title: '2026 ?좊뀈?댁꽭瑜??꾪븳 湲곕낯 ?뺣낫',
      body: '?대쫫, ?앸뀈?붿씪, ?쒖뼱???쒓컙???뺣━?섎㈃ ?곗슫怨??붾? ?먮쫫 ???꾨? ?좊챸?섍쾶 ?쎌쓣 ???덉뒿?덈떎.'
    },
    2: {
      kicker: 'QUESTION 01',
      title: '?? ?붾쭏瑜??믪?寃??섏뼱二쇱꽭??',
      body: '?대쾲 ?붾쭏?먯꽌 媛??以묒슂?섎룄濡?蹂댁뒗 吏덈Ц??紐낆솗?댄븷?섎줉, 寃곌낵 由ы룷?몄쓽 諛⑺뼢???뚯솕?ъ꽦?쇰줈 ?곌껐?섏뼱 ?묐땲??'
    },
    3: {
      kicker: 'QUESTION 02',
      title: '留덉?留?吏덈Ц源뚯? ?④퍡 ?뚮뱶?좊젮??',
      body: '?좊뀈?댁꽭 由ы룷?몃뒗 ?뷀솕?쇰줈 ?쎈뒗 怨좊??깃낵 ?덉씠 ?대룞?덈뒗 由щ벉???뷀븿猿?蹂ㅼ빞 ?쒕뵫?꾨줈 ?댁뼱吏묐땲??'
    },
    4: {
      kicker: 'QUESTION 02',
      title: '留덉?留?吏덈Ц源뚯? ?④퍡 ?뚮뱶?좊젮??',
      body: '?좊뀈?댁꽭 由ы룷?몃뒗 ?뷀솕?쇰줈 ?쎈뒗 怨좊??깃낵 ?덉씠 ?대룞?덈뒗 由щ벉???뷀븿猿?蹂ㅼ빞 ?쒕뵫?꾨줈 ?댁뼱吏묐땲??'
    }
  } as const;
  void _yearlySceneCopyDraft;
  const yearlySceneCopy = {
    1: {
      kicker: 'YEARLY FLOW',
      title: '2026 신년운세를 위한 기본 정보',
      body: '이름, 생년월일, 태어난 시간을 먼저 정리하면 올해 흐름과 가까운 변화 포인트를 훨씬 선명하게 읽을 수 있습니다.'
    },
    2: {
      kicker: 'QUESTION 01',
      title: '올해 가장 궁금한 첫 번째 질문',
      body: '이번 한 해에서 가장 중요하게 보고 싶은 질문을 먼저 적어두면 결과 리포트의 방향과 밀도가 훨씬 선명해집니다.'
    },
    3: {
      kicker: 'QUESTION 02',
      title: '마지막 질문까지 더해 흐름을 완성해 주세요',
      body: '신년운세 리포트는 큰 흐름뿐 아니라 실제로 어떤 선택과 준비가 필요한지까지 함께 보아야 설득력 있게 이어집니다.'
    },
    4: {
      kicker: 'QUESTION 02',
      title: '마지막 질문까지 더해 흐름을 완성해 주세요',
      body: '신년운세 리포트는 큰 흐름뿐 아니라 실제로 어떤 선택과 준비가 필요한지까지 함께 보아야 설득력 있게 이어집니다.'
    }
  } as const;
  const birthPreview = birthDateReady
    ? `${formData.birthDate.replace(/-/g, '.')} ${formData.calendar === 'lunar' ? (formData.isLeapMonth ? '음력 윤달' : '음력') : '양력'}`
    : '생년월일 8자리를 숫자로 입력해 주세요.';
  const birthTimePreview = formData.isUnknownTime
    ? '시간을 모르는 경우에도 기본 사주 흐름 분석은 가능합니다.'
    : formData.birthTime
      ? `${formData.birthTime} 구간으로 결과 리포트에 반영됩니다.`
      : '태어난 시간 구간을 눌러 선택해 주세요.';

  const handleBack = () => {
    if (step === 1) {
      navigate(tabOrigin, { state: { tabOrigin } });
      return;
    }

    setStep((prev) => (prev === 4 ? 3 : prev === 3 ? 2 : 1));
  };

  const submitForm = () => {
    if (!canSubmit) {
      return;
    }

    navigate('/checkout', {
      state: {
        product: service.id,
        formData,
        tabOrigin
      }
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!step1Ready) {
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!step2Ready) {
        return;
      }

      setStep(3);
      return;
    }

    if (step === 3) {
      if (!step3Ready) {
        return;
      }

      setStep(4);
      return;
    }

    submitForm();
  };

  const applyQuestionSuggestion = (key: 'q1' | 'q2', value: string) => {
    updateField(key, value);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main
      className={`intake-story-page intake-step-${step} ${isYearlyFlow ? 'yearly-flow-page' : ''} ${
        isCinematicFlow ? 'signature-video-flow-page' : ''
      } ${isLoveReadingFlow ? 'love-reading-video-flow-page' : ''}`}
    >
      <div className="intake-story-backdrop" />
      <div className="intake-story-shade" />

      <div className="intake-story-frame">
        <header className="intake-story-topbar">
          <Link to="/" className="intake-story-brand">
            <strong>운월당</strong>
          </Link>

          <Link to="/my" className="intake-story-icon" aria-label="마이 페이지">
            <UserRound size={16} />
          </Link>
        </header>

        <section className="intake-story-copy" aria-hidden="true">
          {isYearlyFlow ? (
            <article className="yearly-flow-scene-card">
              <span>{yearlySceneCopy[step].kicker}</span>
              <strong>{yearlySceneCopy[step].title}</strong>
              <p>{yearlySceneCopy[step].body}</p>
            </article>
          ) : null}

          <div className={isCinematicFlow ? 'intake-story-hero-art signature-intake-hero-art' : 'intake-story-hero-art'} aria-hidden="true">
            {isCinematicFlow ? (
              <video
                className="intake-story-hero-video"
                src={isLoveReadingFlow ? '/love-reading-intake-hero.mp4' : '/signature-intake-hero.mp4'}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            ) : (
              <img src={activeVisual.background} alt="" className="intake-story-hero-image" />
            )}
          </div>
        </section>

        <section className="intake-story-panel">
          {step === 1 ? (
            <div className="intake-story-form-stack">
              <label className="intake-story-field">
                <span>나의 이름</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => updateField('name', event.target.value.slice(0, 12))}
                  placeholder="이름을 입력해 주세요"
                  autoFocus
                />
              </label>

              <div className="intake-story-field">
                <div className="intake-story-field-head">
                  <span>나의 생년월일</span>
                  <button
                    type="button"
                    className="intake-story-mini-check"
                    aria-pressed={formData.calendar === 'lunar' && formData.isLeapMonth}
                    onClick={toggleLeapMonth}
                  >
                    <span className={formData.isLeapMonth ? 'intake-story-mini-box checked' : 'intake-story-mini-box'}>
                      <Check size={11} />
                    </span>
                    <small>윤달</small>
                  </button>
                </div>

                <div className="intake-story-pill-row">
                  <button
                    type="button"
                    className={formData.calendar === 'solar' ? 'intake-story-pill active' : 'intake-story-pill'}
                    onClick={() => {
                      updateField('calendar', 'solar');
                      updateField('isLeapMonth', false);
                    }}
                  >
                    양력
                  </button>
                  <button
                    type="button"
                    className={formData.calendar === 'lunar' ? 'intake-story-pill active' : 'intake-story-pill'}
                    onClick={() => updateField('calendar', 'lunar')}
                  >
                    음력
                  </button>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  value={birthDigits}
                  onChange={(event) => updateBirthDate(event.target.value)}
                  placeholder="19901231"
                />
                <p className="intake-story-caption">{birthPreview}</p>
              </div>

              <div className="intake-story-field">
                <div className="intake-story-field-head">
                  <span>태어난 시간</span>
                  <button
                    type="button"
                    className="intake-story-mini-check"
                    aria-pressed={formData.isUnknownTime}
                    onClick={toggleUnknownBirthTime}
                  >
                    <span className={formData.isUnknownTime ? 'intake-story-mini-box checked' : 'intake-story-mini-box'}>
                      <Check size={11} />
                    </span>
                    <small>시간 모름</small>
                  </button>
                </div>
                <div className="intake-story-select-wrap">
                  <select value={getBirthTimeSelectValue(formData)} onChange={(event) => updateBirthTime(event.target.value)}>
                    <option value="">태어난 시간 선택</option>
                    {birthTimeOptions.filter((option) => option.value !== 'unknown').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
                <p className="intake-story-caption">{birthTimePreview}</p>
              </div>

              <div className="intake-story-field">
                <span>나의 성별</span>
                <div className="intake-story-segment-grid">
                  <button
                    type="button"
                    className={formData.gender === 'male' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                    onClick={() => updateField('gender', 'male')}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    className={formData.gender === 'female' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                    onClick={() => updateField('gender', 'female')}
                  >
                    여성
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="intake-story-form-stack">
              <div className="intake-story-question-copy">
                <strong>현재 관계 상태를 알려주세요</strong>
                <p>연애중인지, 솔로인지, 기혼인지에 따라 연애운과 결혼운의 해석 기준이 더 선명해집니다.</p>
              </div>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>현재 상태</strong>
                  <span className="intake-story-order-badge">LOVE</span>
                </div>
                <div className="intake-relationship-grid">
                  {relationshipStatusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        formData.relationshipStatus === option.value
                          ? 'intake-relationship-card active'
                          : 'intake-relationship-card'
                      }
                      onClick={() => updateField('relationshipStatus', option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.body}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>기간은 얼마나 되나요?</strong>
                  <span className="intake-story-order-badge">PERIOD</span>
                </div>
                <div className="intake-relationship-duration-grid">
                  {relationshipDurationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        formData.relationshipDuration === option.value
                          ? 'intake-duration-chip active'
                          : 'intake-duration-chip'
                      }
                      onClick={() => updateField('relationshipDuration', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="intake-story-caption">
                  솔로라면 솔로 기간, 연애중/기혼이라면 현재 관계가 이어진 기간으로 선택해 주세요.
                </p>
              </article>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="intake-story-form-stack">
              <div className="intake-story-question-copy">
                <strong>첫 번째 질문을 적어주세요</strong>
                <p>가장 시급하거나 가장 궁금한 고민을 먼저 적으면 결과 리포트에서 첫 번째 맞춤 답변 카드로 분석됩니다.</p>
              </div>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>질문 1</strong>
                  <span className="intake-story-order-badge">Q1</span>
                </div>
                <textarea
                  value={formData.q1}
                  onChange={(event) => updateField('q1', event.target.value.slice(0, 180))}
                  placeholder="예: 지금 제 인생에서 가장 먼저 정리해야 할 흐름은 무엇인가요?"
                  autoFocus
                />
                <div className="intake-story-question-meta">
                  <span>구체적인 질문일수록 결과 문장이 더 선명해집니다.</span>
                  <span>{formData.q1.length}/180</span>
                </div>
                <div className="intake-story-suggestion-row">
                  {questionSuggestions.q1.map((item) => (
                    <button key={item} type="button" className="intake-story-suggestion" onClick={() => applyQuestionSuggestion('q1', item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="intake-story-form-stack">
              <div className="intake-story-question-copy">
                <strong>두 번째 질문도 적어주세요</strong>
                <p>결제 후 결과 페이지에서는 질문 2개가 각각 따로 분석되며, 사주 기본정보와 함께 GPT 결과로 이어집니다.</p>
              </div>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>질문 2</strong>
                  <span className="intake-story-order-badge">Q2</span>
                </div>
                <textarea
                  value={formData.q2}
                  onChange={(event) => updateField('q2', event.target.value.slice(0, 180))}
                  placeholder="예: 앞으로 3개월 안에 움직이면 좋은 시기는 언제인가요?"
                  autoFocus
                />
                <div className="intake-story-question-meta">
                  <span>질문 1과 다른 방향의 질문이면 리포트 폭이 더 넓어집니다.</span>
                  <span>{formData.q2.length}/180</span>
                </div>
                <div className="intake-story-suggestion-row">
                  {questionSuggestions.q2.map((item) => (
                    <button key={item} type="button" className="intake-story-suggestion" onClick={() => applyQuestionSuggestion('q2', item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </article>
            </div>
          ) : null}

          <footer className="intake-story-actions">
            <button type="button" className="intake-story-secondary" onClick={handleBack}>
              이전
            </button>
            <button
              type="button"
              className="intake-story-primary"
              onClick={handleNext}
              disabled={
                (step === 1 && !step1Ready) ||
                (step === 2 && !step2Ready) ||
                (step === 3 && !step3Ready) ||
                (step === 4 && !step4Ready)
              }
            >
              {step === 4 ? (isYearlyFlow ? '결제하고 신년운세 보기' : '결제 정보 확인') : '다음으로'}
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
