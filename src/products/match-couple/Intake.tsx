import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolveMatchCoupleDraft, saveMatchCoupleDraft } from './draftStorage';
import { matchCoupleProduct } from './index';
import {
  hydrateMatchCoupleIntake,
  matchCoupleBirthLocations,
  serializeMatchCoupleIntake,
  validateMatchCoupleIntake
} from './intakeModel';
import type {
  MatchCoupleIntakeState,
  MatchCouplePersonInput,
  MatchCoupleRelationshipDuration,
  MatchCoupleRelationshipStatus,
  MatchCoupleStoredFormData
} from './types';
import './match-couple.css';

type IntakeStep = 1 | 2 | 3 | 4;
type PersonKey = 'self' | 'partner';

type IntakeLocationState = {
  formData?: Partial<MatchCoupleStoredFormData>;
  tabOrigin?: string;
  draftOwnerId?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
};

const MATCH_COUPLE_PREVIEW_PATH = '/preview/match-couple';

const stepCopy: Record<IntakeStep, { label: string; title: string; description: string }> = {
  1: {
    label: '본인',
    title: '먼저 본인의 출생 정보를 알려주세요',
    description: '이름 대신 평소 사용하는 별칭을 적어도 됩니다.'
  },
  2: {
    label: '상대방',
    title: '상대방의 출생 정보도 입력해 주세요',
    description: '두 명식을 따로 계산한 뒤 공통점과 차이를 비교합니다.'
  },
  3: {
    label: '관계',
    title: '지금 두 사람의 관계를 설명해 주세요',
    description: '현재 맥락은 명리 계산값과 구분해 관계 운영 조언에만 반영합니다.'
  },
  4: {
    label: '질문',
    title: '꼭 알고 싶은 질문 두 가지를 적어주세요',
    description: '두 질문은 각각 별도의 답변으로 정리됩니다.'
  }
};

const relationshipStatuses: Array<{ value: MatchCoupleRelationshipStatus; label: string }> = [
  { value: 'situationship', label: '썸·알아가는 중' },
  { value: 'dating', label: '연애 중' },
  { value: 'ambiguous', label: '애매한 관계' },
  { value: 'breakup-reunion', label: '이별·재회 고민' },
  { value: 'married', label: '기혼·동거 중' }
];

const relationshipDurations: Array<{ value: MatchCoupleRelationshipDuration; label: string }> = [
  { value: 'under1', label: '1년 미만' },
  { value: 'under3', label: '1~3년' },
  { value: 'under5', label: '3~5년' },
  { value: 'under10', label: '5~10년' },
  { value: 'over10', label: '10년 이상' }
];

type PersonFieldsProps = {
  personKey: PersonKey;
  person: MatchCouplePersonInput;
  onChange: (patch: Partial<MatchCouplePersonInput>) => void;
};

function PersonFields({ personKey, person, onChange }: PersonFieldsProps) {
  const prefix = `match-couple-${personKey}`;
  const subject = personKey === 'self' ? '본인' : '상대방';
  const locationValue = person.isUnknownLocation ? '' : person.birthLocation?.label || '';

  return (
    <div className="match-intake-person-fields">
      <label className="match-intake-field" htmlFor={`${prefix}-name`}>
        <span>이름 또는 별칭</span>
        <input
          id={`${prefix}-name`}
          name={`${personKey}-name`}
          type="text"
          value={person.name}
          maxLength={30}
          autoComplete="off"
          placeholder={`${subject}을 구분할 이름이나 별칭`}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>

      <fieldset className="match-intake-fieldset">
        <legend>성별</legend>
        <div className="match-intake-choice-grid two-columns" role="group" aria-label={`${subject} 성별`}>
          {(['female', 'male'] as const).map((gender) => (
            <button
              key={gender}
              type="button"
              className={person.gender === gender ? 'match-intake-choice active' : 'match-intake-choice'}
              aria-pressed={person.gender === gender}
              onClick={() => onChange({ gender })}
            >
              {gender === 'female' ? '여성' : '남성'}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="match-intake-fieldset">
        <legend>달력 기준</legend>
        <div className="match-intake-choice-grid two-columns" role="group" aria-label={`${subject} 양력 또는 음력`}>
          {(['solar', 'lunar'] as const).map((calendar) => (
            <button
              key={calendar}
              type="button"
              className={person.calendar === calendar ? 'match-intake-choice active' : 'match-intake-choice'}
              aria-pressed={person.calendar === calendar}
              onClick={() => onChange({
                calendar,
                isLeapMonth: calendar === 'lunar' ? person.isLeapMonth : false
              })}
            >
              {calendar === 'solar' ? '양력' : '음력'}
            </button>
          ))}
        </div>
        <label className="match-intake-check">
          <input
            type="checkbox"
            checked={person.calendar === 'lunar' && person.isLeapMonth}
            disabled={person.calendar !== 'lunar'}
            onChange={(event) => onChange({ isLeapMonth: event.target.checked })}
          />
          <span>윤달</span>
        </label>
      </fieldset>

      <label className="match-intake-field" htmlFor={`${prefix}-birth-date`}>
        <span>생년월일</span>
        <input
          id={`${prefix}-birth-date`}
          name={`${personKey}-birth-date`}
          type="date"
          min="1900-01-01"
          max="2099-12-31"
          value={person.birthDate}
          onChange={(event) => onChange({ birthDate: event.target.value })}
        />
      </label>

      <div className="match-intake-field">
        <div className="match-intake-field-heading">
          <label htmlFor={`${prefix}-birth-time`}>출생시간</label>
          <label className="match-intake-check compact">
            <input
              type="checkbox"
              checked={person.isUnknownTime}
              onChange={(event) => onChange({
                isUnknownTime: event.target.checked,
                birthTime: event.target.checked ? '' : person.birthTime
              })}
            />
            <span>시간 미상</span>
          </label>
        </div>
        <input
          id={`${prefix}-birth-time`}
          name={`${personKey}-birth-time`}
          type="time"
          value={person.birthTime}
          disabled={person.isUnknownTime}
          aria-describedby={`${prefix}-time-help`}
          onChange={(event) => onChange({ birthTime: event.target.value, isUnknownTime: false })}
        />
        <small id={`${prefix}-time-help`}>
          시간을 모르면 시주와 시간 의존 항목을 제외하고, 리포트에 계산 한계를 표시합니다.
        </small>
      </div>

      <div className="match-intake-field">
        <div className="match-intake-field-heading">
          <label htmlFor={`${prefix}-birth-location`}>출생지역</label>
          <label className="match-intake-check compact">
            <input
              type="checkbox"
              checked={person.isUnknownLocation}
              onChange={(event) => onChange({
                isUnknownLocation: event.target.checked,
                birthLocation: event.target.checked ? undefined : person.birthLocation || matchCoupleBirthLocations[0]
              })}
            />
            <span>지역 미상</span>
          </label>
        </div>
        <select
          id={`${prefix}-birth-location`}
          name={`${personKey}-birth-location`}
          value={locationValue}
          disabled={person.isUnknownLocation}
          onChange={(event) => {
            const birthLocation = matchCoupleBirthLocations.find((item) => item.label === event.target.value);
            onChange({ birthLocation, isUnknownLocation: false });
          }}
        >
          <option value="" disabled>지역 선택</option>
          {matchCoupleBirthLocations.map((location) => (
            <option key={location.label} value={location.label}>{location.label}</option>
          ))}
        </select>
        <small>목록에 없는 국내 지역이나 해외 출생은 지역 미상을 선택해 보정 제외 사실을 리포트에 남겨 주세요.</small>
      </div>
    </div>
  );
}

export default function MatchCoupleIntake() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const locationState = (location.state as IntakeLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || matchCoupleProduct.routes.detail;
  const [step, setStep] = useState<IntakeStep>(1);
  const [showErrors, setShowErrors] = useState(false);
  const [intake, setIntake] = useState<MatchCoupleIntakeState>(() =>
    hydrateMatchCoupleIntake(resolveMatchCoupleDraft({
      routeFormData: locationState?.formData,
      routeDraftOwnerId: locationState?.draftOwnerId,
      currentUserId: user?.id
    }))
  );
  const validation = useMemo(() => validateMatchCoupleIntake(intake), [intake]);
  const currentErrors = validation.stepErrors[step];

  useEffect(() => {
    saveMatchCoupleDraft(serializeMatchCoupleIntake(intake), user?.id);
  }, [intake, user?.id]);

  useEffect(() => {
    setShowErrors(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const updatePerson = (personKey: PersonKey, patch: Partial<MatchCouplePersonInput>) => {
    setIntake((current) => ({
      ...current,
      [personKey]: {
        ...current[personKey],
        ...patch
      }
    }));
  };

  const updateContext = (patch: Partial<MatchCoupleIntakeState['context']>) => {
    setIntake((current) => ({
      ...current,
      context: {
        ...current.context,
        ...patch
      }
    }));
  };

  const updateQuestion = (index: 0 | 1, value: string) => {
    const questions: [string, string] = index === 0
      ? [value, intake.context.questions[1]]
      : [intake.context.questions[0], value];
    updateContext({ questions });
  };

  const handleBack = () => {
    if (step === 1) {
      navigate(tabOrigin, { state: { tabOrigin } });
      return;
    }

    setStep((current) => (current - 1) as IntakeStep);
  };

  const handleContinue = () => {
    if (currentErrors.length > 0) {
      setShowErrors(true);
      return;
    }

    setStep((current) => (current + 1) as IntakeStep);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validation.valid) {
      const firstInvalidStep = ([1, 2, 3, 4] as const).find(
        (candidate) => validation.stepErrors[candidate].length > 0
      );
      if (firstInvalidStep) setStep(firstInvalidStep);
      setShowErrors(true);
      return;
    }

    const formData = serializeMatchCoupleIntake(intake);

    saveMatchCoupleDraft(formData, user?.id);
    navigate(MATCH_COUPLE_PREVIEW_PATH, {
      state: {
        formData,
        tabOrigin,
        draftOwnerId: user?.id,
        recoveredEntitlement: locationState?.recoveredEntitlement
      }
    });
  };

  return (
    <main className="match-intake-page">
      <div className="match-intake-shell">
        <header className="match-intake-topbar">
          <button type="button" onClick={handleBack} aria-label={step === 1 ? '상품 상세로 돌아가기' : '이전 단계로 돌아가기'}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <strong>월연도령 사주궁합</strong>
          <span aria-hidden="true">{step}/4</span>
        </header>

        <nav className="match-intake-progress" aria-label="궁합 입력 진행 단계">
          <ol>
            {([1, 2, 3, 4] as const).map((item) => (
              <li key={item} className={step === item ? 'active' : step > item ? 'complete' : undefined} aria-current={step === item ? 'step' : undefined}>
                <span>{item}</span>
                <small>{stepCopy[item].label}</small>
              </li>
            ))}
          </ol>
        </nav>

        <form className="match-intake-form" noValidate onSubmit={handleSubmit}>
          <section className="match-intake-heading" aria-labelledby="match-intake-title">
            <span>STEP {String(step).padStart(2, '0')}</span>
            <h1 id="match-intake-title">{stepCopy[step].title}</h1>
            <p>{stepCopy[step].description}</p>
          </section>

          {step === 1 ? (
            <PersonFields
              personKey="self"
              person={intake.self}
              onChange={(patch) => updatePerson('self', patch)}
            />
          ) : null}

          {step === 2 ? (
            <PersonFields
              personKey="partner"
              person={intake.partner}
              onChange={(patch) => updatePerson('partner', patch)}
            />
          ) : null}

          {step === 3 ? (
            <div className="match-intake-context-fields">
              <fieldset className="match-intake-fieldset">
                <legend>현재 관계 상태</legend>
                <div className="match-intake-choice-grid relationship-grid">
                  {relationshipStatuses.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={intake.context.relationshipStatus === option.value ? 'match-intake-choice active' : 'match-intake-choice'}
                      aria-pressed={intake.context.relationshipStatus === option.value}
                      onClick={() => updateContext({ relationshipStatus: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="match-intake-fieldset">
                <legend>관계 기간</legend>
                <div className="match-intake-choice-grid duration-grid">
                  {relationshipDurations.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={intake.context.relationshipDuration === option.value ? 'match-intake-choice active' : 'match-intake-choice'}
                      aria-pressed={intake.context.relationshipDuration === option.value}
                      onClick={() => updateContext({ relationshipDuration: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="match-intake-field" htmlFor="match-couple-major-conflict">
                <span>두 사람의 주요 갈등</span>
                <textarea
                  id="match-couple-major-conflict"
                  value={intake.context.majorConflict}
                  maxLength={140}
                  rows={4}
                  placeholder="반복해서 부딪히는 상황과 서로의 반응을 적어 주세요."
                  onChange={(event) => updateContext({ majorConflict: event.target.value })}
                />
                <small>{intake.context.majorConflict.length}/140</small>
              </label>

              <label className="match-intake-field" htmlFor="match-couple-desired-insight">
                <span>이번 궁합에서 알고 싶은 점</span>
                <textarea
                  id="match-couple-desired-insight"
                  value={intake.context.desiredInsight}
                  maxLength={100}
                  rows={3}
                  placeholder="관계를 위해 가장 확인하고 싶은 기준을 적어 주세요."
                  onChange={(event) => updateContext({ desiredInsight: event.target.value })}
                />
                <small>{intake.context.desiredInsight.length}/100</small>
              </label>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="match-intake-question-fields">
              {([0, 1] as const).map((index) => (
                <label key={index} className="match-intake-field match-intake-question" htmlFor={`match-couple-question-${index + 1}`}>
                  <span>질문 {index + 1}</span>
                  <textarea
                    id={`match-couple-question-${index + 1}`}
                    value={intake.context.questions[index]}
                    maxLength={120}
                    rows={4}
                    placeholder={index === 0 ? '첫 번째로 알고 싶은 내용을 적어 주세요.' : '두 번째로 알고 싶은 내용을 적어 주세요.'}
                    onChange={(event) => updateQuestion(index, event.target.value)}
                  />
                  <small>{intake.context.questions[index].length}/120</small>
                </label>
              ))}
              <p className="match-intake-privacy-note">
                입력한 두 사람의 정보는 개인 리포트 생성과 보관에만 사용되며 공유 문구에는 포함하지 않습니다.
              </p>
            </div>
          ) : null}

          {showErrors && currentErrors.length > 0 ? (
            <div className="match-intake-errors" role="alert" aria-live="assertive">
              <strong>입력 내용을 확인해 주세요.</strong>
              <ul>
                {currentErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          ) : null}

          <footer className="match-intake-actions">
            <button type="button" className="match-intake-secondary" onClick={handleBack}>
              이전
            </button>
            {step < 4 ? (
              <button type="button" className="match-intake-primary" onClick={handleContinue}>
                다음
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button type="submit" className="match-intake-primary">
                무료 궁합 미리보기
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
          </footer>
        </form>
      </div>
    </main>
  );
}
