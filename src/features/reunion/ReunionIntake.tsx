import { ArrowLeft, ArrowRight, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateBirthInput } from '../../lib/birthInputValidation';
import {
  normalizeReunionContext,
  validateReunionContext,
  writeReunionContext,
  type ReunionContext
} from '../../lib/reunion';
import '../../styles/reunion.css';
import { readReunionDraft, writeReunionDraft } from './intakeStorage';
import {
  REUNION_PATHS,
  breakupDurationLabels,
  contactStatusLabels,
  createEmptyReunionDraft,
  createReunionFormData,
  desiredOutcomeLabels,
  getReunionRouteContext,
  hydrateReunionDraft,
  type ReunionIntakeDraft,
  type ReunionPersonDraft,
  type ReunionRouteState
} from './reunionFlow';

type IntakeStep = 1 | 2 | 3 | 4;
type PersonKey = 'self' | 'partner';

const stepMeta: Readonly<Record<IntakeStep, { eyebrow: string; title: string; guide: string }>> = {
  1: {
    eyebrow: '첫 번째 · 나의 정보',
    title: '먼저, 나를 알려주세요',
    guide: '생년월일시는 명식을 계산하는 데만 사용하며 리포트 공유 문구에는 포함하지 않아요.'
  },
  2: {
    eyebrow: '두 번째 · 상대방 정보',
    title: '그 사람을 알려주세요',
    guide: '상대방이 제공했거나 이용에 동의한 정보만 입력해 주세요.'
  },
  3: {
    eyebrow: '세 번째 · 이별 이후',
    title: '지금 두 사람의 거리는 어떤가요?',
    guide: '상대의 마음을 추측하기보다 실제로 확인된 연락 상태를 선택해 주세요.'
  },
  4: {
    eyebrow: '마지막 · 알고 싶은 것',
    title: '지금 가장 필요한 답을 적어주세요',
    guide: '구체적인 상황을 적을수록 행동 기준을 더 현실적으로 정리할 수 있어요.'
  }
};

const today = new Date().toISOString().slice(0, 10);

function personValidationInput(person: ReunionPersonDraft) {
  return {
    ...person,
    birthTime: person.isUnknownTime ? '' : person.birthTime,
    birthTimePrecision: person.isUnknownTime ? 'unknown' as const : 'exact' as const,
    dayBoundaryPolicy: 'midnight' as const
  };
}

function isPersonShapeReady(person: ReunionPersonDraft) {
  return Boolean(
    person.name.trim() &&
    person.gender &&
    person.birthDate &&
    (person.isUnknownTime || person.birthTime)
  );
}

function PersonFields({
  person,
  personKey,
  label,
  onChange
}: {
  person: ReunionPersonDraft;
  personKey: PersonKey;
  label: string;
  onChange: <K extends keyof ReunionPersonDraft>(key: K, value: ReunionPersonDraft[K]) => void;
}) {
  const id = `reunion-${personKey}`;

  return (
    <fieldset className="reunion-person-fields">
      <legend className="reunion-visually-hidden">{label}의 출생 정보</legend>

      <label className="reunion-field" htmlFor={`${id}-name`}>
        <span>{label} 이름 또는 호칭</span>
        <input
          id={`${id}-name`}
          value={person.name}
          maxLength={20}
          autoComplete={personKey === 'self' ? 'name' : 'off'}
          placeholder={personKey === 'self' ? '예: 지윤' : '예: 그 사람'}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>

      <fieldset className="reunion-choice-field">
        <legend>{label} 성별</legend>
        <div className="reunion-segmented is-two">
          {([
            ['female', '여성'],
            ['male', '남성']
          ] as const).map(([value, text]) => (
            <label key={value} className={person.gender === value ? 'is-selected' : undefined}>
              <input
                type="radio"
                name={`${id}-gender`}
                value={value}
                checked={person.gender === value}
                onChange={() => onChange('gender', value)}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="reunion-choice-field">
        <legend>달력 기준</legend>
        <div className="reunion-segmented is-two">
          {([
            ['solar', '양력'],
            ['lunar', '음력']
          ] as const).map(([value, text]) => (
            <label key={value} className={person.calendar === value ? 'is-selected' : undefined}>
              <input
                type="radio"
                name={`${id}-calendar`}
                value={value}
                checked={person.calendar === value}
                onChange={() => {
                  onChange('calendar', value);
                  if (value === 'solar') onChange('isLeapMonth', false);
                }}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
        {person.calendar === 'lunar' ? (
          <label className="reunion-checkbox is-compact">
            <input
              type="checkbox"
              checked={person.isLeapMonth}
              onChange={(event) => onChange('isLeapMonth', event.target.checked)}
            />
            <span>윤달이에요</span>
          </label>
        ) : null}
      </fieldset>

      <div className="reunion-birth-grid">
        <label className="reunion-field" htmlFor={`${id}-date`}>
          <span>생년월일</span>
          <input
            id={`${id}-date`}
            type="date"
            value={person.birthDate}
            max={today}
            onChange={(event) => onChange('birthDate', event.target.value)}
          />
        </label>
        <label className="reunion-field" htmlFor={`${id}-time`}>
          <span>태어난 시간</span>
          <input
            id={`${id}-time`}
            type="time"
            value={person.birthTime}
            disabled={person.isUnknownTime}
            onChange={(event) => onChange('birthTime', event.target.value)}
          />
        </label>
      </div>

      <label className="reunion-checkbox">
        <input
          type="checkbox"
          checked={person.isUnknownTime}
          onChange={(event) => {
            onChange('isUnknownTime', event.target.checked);
            if (event.target.checked) onChange('birthTime', '');
          }}
        />
        <span>
          <strong>태어난 시간을 몰라요</strong>
          <small>시주를 제외한 확인 가능한 범위로 안내합니다.</small>
        </span>
      </label>
    </fieldset>
  );
}

function buildContext(draft: ReunionIntakeDraft) {
  return normalizeReunionContext({
    breakupDuration: draft.breakupDuration,
    lastContactAt: draft.lastContactAt || undefined,
    contactStatus: draft.contactStatus,
    breakupReason: draft.breakupReason.trim() || undefined,
    desiredOutcome: draft.desiredOutcome,
    notes: draft.notes.trim() || undefined,
    consentToUsePartnerData: draft.consentToUsePartnerData
  });
}

export default function ReunionIntake() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeState = (location.state as ReunionRouteState | null) || null;
  const ownerId = user?.id;
  const storedDraft = useMemo(
    () => readReunionDraft(ownerId) || readReunionDraft(),
    [ownerId]
  );
  const initialDraft = useMemo(
    () => routeState?.formData || routeState?.reunionContext
      ? hydrateReunionDraft(routeState.formData, getReunionRouteContext(routeState))
      : storedDraft?.draft || createEmptyReunionDraft(),
    [routeState, storedDraft]
  );
  const [step, setStep] = useState<IntakeStep>(1);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState('');
  const meta = stepMeta[step];
  const tabOrigin = routeState?.tabOrigin || REUNION_PATHS.detail;

  useEffect(() => {
    writeReunionDraft(draft, ownerId);
  }, [draft, ownerId]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setError('');
  }, [step]);

  const updatePerson = <K extends keyof ReunionPersonDraft>(
    personKey: PersonKey,
    key: K,
    value: ReunionPersonDraft[K]
  ) => {
    setDraft((current) => ({
      ...current,
      [personKey]: { ...current[personKey], [key]: value }
    }));
  };

  const updateDraft = <K extends keyof ReunionIntakeDraft>(key: K, value: ReunionIntakeDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const stepReady = useMemo(() => {
    if (step === 1) return isPersonShapeReady(draft.self);
    if (step === 2) return isPersonShapeReady(draft.partner);
    if (step === 3) return Boolean(draft.breakupDuration && draft.contactStatus && draft.desiredOutcome);
    return draft.breakupReason.trim().length >= 4 && draft.question.trim().length >= 8 && draft.consentToUsePartnerData;
  }, [draft, step]);

  const validateCurrentStep = () => {
    if (step === 1 || step === 2) {
      const person = step === 1 ? draft.self : draft.partner;
      const result = validateBirthInput(personValidationInput(person), {
        subjectLabel: step === 1 ? '본인' : '상대방'
      });
      if (!result.valid) {
        setError(result.errors[0]?.message || '출생 정보를 다시 확인해 주세요.');
        return false;
      }
    }

    if (step === 4 && draft.breakupReason.trim().length < 4) {
      setError('헤어지게 된 배경을 확인된 사실 위주로 4자 이상 적어주세요.');
      return false;
    }
    if (step === 4 && draft.question.trim().length < 8) {


      setError('궁금한 내용을 8자 이상 적어주세요.');
      return false;
    }

    if (step === 4 && !draft.consentToUsePartnerData) {
      setError('상대방 정보 이용 확인이 필요합니다.');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!stepReady || !validateCurrentStep()) return;

    if (step < 4) {
      setStep((current) => (current + 1) as IntakeStep);
      return;
    }

    try {
      const formData = createReunionFormData(draft);
      const reunionContext = buildContext(draft);
      const contextValidation = validateReunionContext(reunionContext);

      if (!contextValidation.valid) {
        setError(contextValidation.errors[0]?.message || '이별 이후의 상황을 다시 확인해 주세요.');
        return;
      }

      writeReunionDraft(draft, ownerId, reunionContext);
      writeReunionContext(reunionContext, ownerId);
      navigate(REUNION_PATHS.preview, {
        state: {
          formData,
          reunionContext,
          tabOrigin,
          draftOwnerId: ownerId,
          recoveredEntitlement: routeState?.recoveredEntitlement
        } satisfies ReunionRouteState
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '입력 정보를 저장하지 못했습니다.');
    }
  };

  const handleBack = () => {
    if (step === 1) {
      navigate(tabOrigin);
      return;
    }
    setStep((current) => (current - 1) as IntakeStep);
  };

  const resetDraft = () => {
    setDraft(createEmptyReunionDraft());
    setStep(1);
    setError('');
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <PersonFields
          person={draft.self}
          personKey="self"
          label="나"
          onChange={(key, value) => updatePerson('self', key, value)}
        />
      );
    }

    if (step === 2) {
      return (
        <>
          <PersonFields
            person={draft.partner}
            personKey="partner"
            label="상대방"
            onChange={(key, value) => updatePerson('partner', key, value)}
          />
          <aside className="reunion-privacy-note">
            <ShieldCheck size={19} aria-hidden="true" />
            <p>상대방의 연락처는 받지 않으며, 입력한 출생 정보는 현재 브라우저 세션에만 임시 저장합니다.</p>
          </aside>
        </>
      );
    }

    if (step === 3) {
      return (
        <div className="reunion-context-fields">
          <fieldset className="reunion-choice-field">
            <legend>헤어진 지 얼마나 되었나요?</legend>
            <div className="reunion-option-list is-compact">
              {Object.entries(breakupDurationLabels).map(([value, label]) => (
                <label key={value} className={draft.breakupDuration === value ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="breakup-duration"
                    checked={draft.breakupDuration === value}
                    onChange={() => updateDraft('breakupDuration', value as ReunionContext['breakupDuration'])}
                  />
                  <span>{label}</span>
                  <Check size={17} aria-hidden="true" />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="reunion-choice-field">
            <legend>현재 연락 상태는 어떤가요?</legend>
            <div className="reunion-option-list">
              {Object.entries(contactStatusLabels).map(([value, label]) => (
                <label key={value} className={draft.contactStatus === value ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="contact-status"
                    checked={draft.contactStatus === value}
                    onChange={() => updateDraft('contactStatus', value as ReunionContext['contactStatus'])}
                  />
                  <span>{label}</span>
                  <Check size={17} aria-hidden="true" />
                </label>
              ))}
            </div>
          </fieldset>

          <label className="reunion-field" htmlFor="reunion-last-contact">
            <span>마지막으로 연락한 날 <small>선택</small></span>
            <input
              id="reunion-last-contact"
              type="date"
              value={draft.lastContactAt}
              max={today}
              onChange={(event) => updateDraft('lastContactAt', event.target.value)}
            />
          </label>

          <fieldset className="reunion-choice-field">
            <legend>이번 리포트로 얻고 싶은 것은?</legend>
            <div className="reunion-option-list is-compact">
              {Object.entries(desiredOutcomeLabels).map(([value, label]) => (
                <label key={value} className={draft.desiredOutcome === value ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="desired-outcome"
                    checked={draft.desiredOutcome === value}
                    onChange={() => updateDraft('desiredOutcome', value as ReunionContext['desiredOutcome'])}
                  />
                  <span>{label}</span>
                  <Check size={17} aria-hidden="true" />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    return (
      <div className="reunion-question-fields">
        <label className="reunion-field" htmlFor="reunion-breakup-reason">
          <span>헤어지게 된 배경 <small>필수</small></span>
          <textarea
            id="reunion-breakup-reason"
            value={draft.breakupReason}
            maxLength={300}
            rows={4}
            placeholder="확인된 사실 위주로 적어주세요."
            onChange={(event) => updateDraft('breakupReason', event.target.value)}
          />
          <small className="reunion-character-count">{draft.breakupReason.length}/300</small>
        </label>
        <label className="reunion-field" htmlFor="reunion-question">
          <span>가장 궁금한 한 가지</span>
          <textarea
            id="reunion-question"
            value={draft.question}
            maxLength={300}
            rows={5}
            placeholder="예: 한 달째 연락하지 않고 있어요. 먼저 안부를 물어도 될지, 기다린다면 어떤 신호를 봐야 할지 알고 싶어요."
            onChange={(event) => updateDraft('question', event.target.value)}
          />
          <small className="reunion-character-count">{draft.question.length}/300 · 최소 8자</small>
        </label>
        <label className="reunion-field" htmlFor="reunion-notes">
          <span>리포트에 반영할 추가 상황 <small>선택</small></span>
          <textarea
            id="reunion-notes"
            value={draft.notes}
            maxLength={300}
            rows={3}
            placeholder="공동 일정, 돌려받을 물건처럼 현실적으로 고려할 내용을 적어주세요."
            onChange={(event) => updateDraft('notes', event.target.value)}
          />
        </label>
        <label className="reunion-checkbox is-consent">
          <input
            type="checkbox"
            checked={draft.consentToUsePartnerData}
            onChange={(event) => updateDraft('consentToUsePartnerData', event.target.checked)}
          />
          <span>
            <strong>상대방의 출생 정보 이용 권한을 확인했습니다.</strong>
            <small>상대방이 제공했거나 서비스 이용에 동의한 정보만 입력합니다.</small>
          </span>
        </label>
      </div>
    );
  };

  return (
    <main className="reunion-page reunion-intake-page">
      <header className="reunion-intake-header">
        <button type="button" onClick={handleBack} aria-label={step === 1 ? '재회운 소개로 돌아가기' : '이전 단계'}>
          <ArrowLeft size={23} aria-hidden="true" />
        </button>
        <strong>운월당 재회운</strong>
        <button type="button" onClick={resetDraft} aria-label="입력 내용 초기화">
          <RotateCcw size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="reunion-progress" aria-label={`전체 4단계 중 ${step}단계`}>
        <span>{step} / 4</span>
        <progress value={step} max={4}>{step} / 4</progress>
      </div>

      <section className="reunion-intake-card" aria-labelledby="reunion-step-title">
        <div className="reunion-intake-heading">
          <span>{meta.eyebrow}</span>
          <h1 id="reunion-step-title">{meta.title}</h1>
          <p>{meta.guide}</p>
        </div>
        {renderStep()}
        <p className="reunion-inline-error" role="alert" aria-live="assertive">{error}</p>
      </section>

      <footer className="reunion-intake-actions">
        <button type="button" className="reunion-secondary-button" onClick={handleBack}>
          이전
        </button>
        <button type="button" className="reunion-primary-button" disabled={!stepReady} onClick={handleNext}>
          <span>{step === 4 ? '무료 미리보기 보기' : '다음'}</span>
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </footer>
    </main>
  );
}
