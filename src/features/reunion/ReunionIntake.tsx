import { ArrowLeft, ArrowRight, Check, RotateCcw, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateBirthInput, type BirthInputValidationField } from '../../lib/birthInputValidation';
import {
  normalizeReunionContext,
  validateReunionContext,
  writeReunionContext,
  type ReunionContext
} from '../../lib/reunion';
import '../../styles/reunion-premium.css';
import '../../styles/reunion.css';
import '../../styles/reunion-intake.css';
import {
  birthDigits,
  clockDigits,
  displayBirthDigits,
  EMPTY_CLOCK,
  fromIsoBirthDate,
  isBirthDigitsReady,
  isNotFuture,
  ledgerSummary,
  parseClock,
  toClockValue,
  toIsoBirthDate,
  type ClockDraft,
  type ClockPeriod
} from './intakeFields';
import { readReunionDraft, writeReunionDraft } from './intakeStorage';
import {
  UdBubble,
  UdCartouche,
  UdCorners,
  UdGlyph,
  UdMedallion,
  UdOrnamentDefs,
  type UdGlyphName
} from './reunionOrnaments';
import { reunionPanelImages, type ReunionPanelKey } from './reunionPanelAssets';
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

/* ══════════════════════════════════════════════════════════════════════════
   장(章)과 걸음
   ══════════════════════════════════════════════════════════════════════════
   재회운은 본인과 상대방, 두 사람의 출생 정보에 이별 이후의 상황까지 받는다.
   한 화면에 다 얹으면 스크롤이 길어지고 '서류' 가 된다. 그래서 자사 MZ 팩폭
   연애운 입력창과 같은 방식 — 한 화면에 하나만 묻고 고르면 바로 넘어간다 — 을
   쓰되, 12걸음을 네 장으로 묶어 진행감을 장 단위로 보여 준다.
   사용자는 '12단계' 가 아니라 '네 장 중 두 번째' 로 읽는다. */

type IntakeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
type ChapterId = 1 | 2 | 3 | 4;
type PersonKey = 'self' | 'partner';

const TOTAL_STEPS = 13;
const LAST_STEP: IntakeStep = 13;

type Chapter = {
  id: ChapterId;
  numeral: string;
  name: string;
  steps: readonly IntakeStep[];
};

const CHAPTERS: readonly Chapter[] = [
  { id: 1, numeral: '一', name: '나', steps: [1, 2, 3, 4] },
  { id: 2, numeral: '二', name: '그 사람', steps: [5, 6, 7, 8] },
  { id: 3, numeral: '三', name: '이별 이후', steps: [9, 10, 11, 12] },
  { id: 4, numeral: '四', name: '물음', steps: [13] }
];

const STEP_CHAPTER: Readonly<Record<IntakeStep, ChapterId>> = {
  1: 1, 2: 1, 3: 1, 4: 1,
  5: 2, 6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3, 12: 3,
  13: 4
};

type StepMeta = {
  title: string;
  guide: string;
  /** 이 걸음에서 뒤에 깔리는 아트. 장이 바뀌면 장면도 바뀐다. */
  shot: ReunionPanelKey;
  glyph: UdGlyphName;
};

/* 화자는 운월이다. 존댓말이고, 기대가 아니라 행동을 기준으로 말한다.
   재회를 확률로 단정하지 않고, 멈춰야 하는 경우도 같은 분량으로 쓴다. */
const STEP_META: Readonly<Record<IntakeStep, StepMeta>> = {
  1: {
    title: '먼저 태어난 날을 알려주세요',
    guide: '명식을 세우는 첫 자리입니다. 생년월일시는 계산에만 쓰고, 리포트 공유 문구에는 넣지 않아요.',
    shot: 'reflect',
    glyph: 'crescent'
  },
  2: {
    title: '태어난 시간은 언제인가요',
    guide: '시간을 알면 관계의 속도와 시기까지 좁혀서 볼 수 있어요. 모르면 아래를 눌러 주세요.',
    shot: 'reflect',
    glyph: 'lantern'
  },
  3: {
    title: '성별을 알려주세요',
    guide: '대운이 흐르는 방향을 계산할 때만 씁니다.',
    shot: 'reflect',
    glyph: 'petal'
  },
  4: {
    title: '어떻게 불러드리면 될까요',
    guide: '리포트에서 이 이름으로 말을 건넵니다. 본명이 아니어도 괜찮아요.',
    shot: 'reflect',
    glyph: 'seal'
  },
  5: {
    title: '그 사람의 정보를 입력하기 전에',
    guide: '두 사람의 명식을 함께 보려면 확인이 필요합니다.',
    shot: 'letter',
    glyph: 'gate'
  },
  6: {
    title: '그 사람을 어떻게 적을까요',
    guide: '본명이 아니어도 됩니다. 리포트에서 부를 호칭과 성별만 있으면 돼요.',
    shot: 'knot',
    glyph: 'knot'
  },
  7: {
    title: '그 사람이 태어난 날은요',
    guide: '양력과 음력을 먼저 고르고 여덟 자리를 적어 주세요.',
    shot: 'knot',
    glyph: 'crescent'
  },
  8: {
    title: '그 사람이 태어난 시간은요',
    guide: '모르는 경우가 더 많습니다. 모르면 아래를 눌러 주세요.',
    shot: 'knot',
    glyph: 'lantern'
  },
  9: {
    title: '헤어진 지 얼마나 되었나요',
    guide: '지난 시간의 길이에 따라 먼저 볼 자리가 달라집니다.',
    shot: 'thread',
    glyph: 'thread'
  },
  10: {
    title: '지금 두 사람의 거리는 어떤가요',
    guide: '상대의 마음을 추측하지 않고, 실제로 확인된 연락 상태만 고릅니다.',
    shot: 'phones',
    glyph: 'thread'
  },
  /* 이 걸음이 따로 있는 이유: 선택 항목이라 고르면 바로 넘어가는 화면 아래에
     붙여 두면, 연락 상태를 고르는 순간 화면이 바뀌어 **영구히 도달할 수 없다**.
     실측으로 확인했다. 그래서 건너뛸 수 있는 자기 걸음으로 뺐다. */
  11: {
    title: '마지막으로 연락한 날을 기억하세요?',
    guide: '선택 항목입니다. 기억나지 않으면 건너뛰어도 리포트는 그대로 나옵니다.',
    shot: 'phones',
    glyph: 'seal'
  },
  12: {
    title: '이번 리포트로 무엇을 얻고 싶으세요',
    guide: '기대가 아니라 행동을 기준으로 다음 한 걸음만 정리해요.',
    shot: 'thread',
    glyph: 'gate'
  },
  13: {
    title: '마지막으로, 지금 가장 필요한 답을 적어주세요',
    guide: '확인된 사실 위주로 적을수록 행동 기준이 현실적으로 정리됩니다.',
    shot: 'dawn',
    glyph: 'lantern'
  }
};

/** 배경으로 쓰는 컷. 교차 페이드를 위해 전부 미리 붙여 둔다. */
const STAGE_SHOTS: readonly ReunionPanelKey[] = ['reflect', 'letter', 'knot', 'thread', 'phones', 'dawn'];

/* 선택지의 부제 — '왜 이걸 묻는가' 를 적는다. 라벨 자체는 reunionFlow.ts 가
   소유하므로 여기서 바꾸지 않는다. */
const CONTACT_DETAIL: Readonly<Record<ReunionContext['contactStatus'], string>> = {
  'no-contact': '침묵이 길어진 자리부터 읽습니다',
  occasional: '대화의 간격과 온도를 봅니다',
  active: '지금 오가는 말의 결을 봅니다',
  blocked: '멈춰야 하는 경우도 같은 분량으로 씁니다',
  unknown: '단정하지 않고 확인할 순서를 먼저 정리해요'
};

const OUTCOME_DETAIL: Readonly<Record<ReunionContext['desiredOutcome'], string>> = {
  reconnect: '다시 만나려면 무엇을 확인해야 하는지',
  closure: '마음을 정리하는 순서를 같은 분량으로',
  clarity: '먼저 연락해도 될지 판단 기준을 세웁니다',
  unsure: '고르지 않아도 됩니다. 두 방향을 함께 씁니다'
};

/* 검증기가 어느 필드에서 걸렸는지에 따라 그 필드를 물은 걸음으로 되돌린다.
   윤달 없는 달처럼 달력 프리플라이트에서만 드러나는 오류가 여기로 온다. */
function stepForField(field: BirthInputValidationField, person: PersonKey): IntakeStep {
  if (person === 'self') {
    if (field === 'birthTime' || field === 'birthTimePrecision') return 2;
    if (field === 'gender') return 3;
    if (field === 'name') return 4;
    return 1;
  }
  if (field === 'birthTime' || field === 'birthTimePrecision') return 8;
  if (field === 'gender' || field === 'name') return 6;
  return 7;
}

function personValidationInput(person: ReunionPersonDraft) {
  return {
    ...person,
    birthTime: person.isUnknownTime ? '' : person.birthTime,
    birthTimePrecision: person.isUnknownTime ? 'unknown' as const : 'exact' as const,
    dayBoundaryPolicy: 'midnight' as const
  };
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

/** `ud-step` 은 감속 선호에서 꺼지므로 지연도 함께 무력화된다. */
const rise = (index: number): CSSProperties => ({ animationDelay: `${index * 70}ms` });

/**
 * 오류 문구의 고정 id.
 * 걸음마다 오류는 하나뿐이므로 id 도 하나면 된다. `role="alert"` 는 오류가 **생기는
 * 순간**만 읽어 주고, 나중에 그 필드로 되돌아온 스크린리더 사용자에게는 아무것도
 * 알려주지 않는다. 그래서 필드 쪽에 `aria-invalid` 와 `aria-describedby` 를 함께 건다.
 */
const ERROR_ID = 'reunion-step-error';

export default function ReunionIntake() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeState = (location.state as ReunionRouteState | null) || null;
  const ownerId = user?.id;
  const storedDraft = useMemo(() => readReunionDraft(ownerId) || readReunionDraft(), [ownerId]);
  const initialDraft = useMemo(
    () => routeState?.formData || routeState?.reunionContext
      ? hydrateReunionDraft(routeState.formData, getReunionRouteContext(routeState))
      : storedDraft?.draft || createEmptyReunionDraft(),
    [routeState, storedDraft]
  );

  const [step, setStep] = useState<IntakeStep>(1);
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState('');
  const [notesOpen, setNotesOpen] = useState(Boolean(initialDraft.notes));

  /* 화면 상태와 드래프트 값을 분리한다. 드래프트는 항상 `reunionFlow.ts` 의
     계약형(ISO 날짜 · HH:mm)을 들고 있고, 여기 버퍼는 사람이 두드리는 형태다. */
  const [dateDigits, setDateDigits] = useState<Record<PersonKey, string>>(() => ({
    self: fromIsoBirthDate(initialDraft.self.birthDate),
    partner: fromIsoBirthDate(initialDraft.partner.birthDate)
  }));
  const [clock, setClock] = useState<Record<PersonKey, ClockDraft>>(() => ({
    self: parseClock(initialDraft.self.birthTime),
    partner: parseClock(initialDraft.partner.birthTime)
  }));
  const [contactDigits, setContactDigits] = useState(() => fromIsoBirthDate(initialDraft.lastContactAt));

  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const steppedRef = useRef(false);

  const chapterId = STEP_CHAPTER[step];
  const chapter = CHAPTERS[chapterId - 1];
  const meta = STEP_META[step];
  /* 오류가 있는 동안만 붙는다. 없을 때 `aria-invalid="false"` 를 남겨 두면
     보조기술이 매번 '유효함' 을 읽어 소음이 된다. */
  const invalidProps = error ? { 'aria-invalid': true, 'aria-describedby': ERROR_ID } : {};
  const tabOrigin = routeState?.tabOrigin || REUNION_PATHS.detail;

  useEffect(() => {
    writeReunionDraft(draft, ownerId);
  }, [draft, ownerId]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setError('');

    /* 걸음이 바뀔 때의 포커스.
       걸음 전환은 `<section key={step}>` 리마운트로 일어난다. 텍스트 필드가 있는
       걸음은 autoFocus 가 받아 주지만, **선택지만 있는 걸음**(성별 · 동의 · 연락
       상태 · 원하는 것)에는 autoFocus 대상이 없다. 그래서 선택지를 눌러 자동
       진행하면 눌린 버튼이 언마운트되면서 포커스가 document.body 로 떨어지고,
       키보드 · 스크린리더 사용자는 문서 맨 앞으로 돌아가 상단바와 장 레일을 다시
       지나야 새 걸음의 컨트롤에 닿는다.

       autoFocus 는 React 의 커밋 단계에서 적용되므로 이 이펙트가 돌 때는 이미
       끝나 있다. 따라서 '판 안에 아무도 포커스를 받지 않았을 때만' 제목으로
       옮기면 두 경우가 모두 맞는다 — autoFocus 를 빼앗지 않고, 빈 곳으로 떨어지는
       경우만 막는다. 제목은 aria-labelledby 로 판과 연결돼 있어 새 걸음이 읽힌다.

       최초 마운트는 제외한다. 페이지를 연 순간 포커스를 가져가지 않는다. */
    if (!steppedRef.current) {
      steppedRef.current = true;
      return;
    }

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      titleRef.current?.focus();
    }
  }, [step]);

  const updatePerson = <K extends keyof ReunionPersonDraft>(
    key: PersonKey,
    field: K,
    value: ReunionPersonDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  };

  const patchPerson = (key: PersonKey, patch: Partial<ReunionPersonDraft>) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };

  const updateDraft = <K extends keyof ReunionIntakeDraft>(key: K, value: ReunionIntakeDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const goTo = (next: IntakeStep) => {
    setError('');
    setStep(next);
  };

  const advance = () => {
    if (step < LAST_STEP) goTo((step + 1) as IntakeStep);
  };

  /* ── 날짜 ────────────────────────────────────────────────────────── */

  const handleDateChange = (key: PersonKey, raw: string) => {
    const digits = birthDigits(raw);
    setDateDigits((current) => ({ ...current, [key]: digits }));
    updatePerson(key, 'birthDate', toIsoBirthDate(digits, draft[key].calendar));

    if (digits.length !== 8) return;
    if (!isBirthDigitsReady(digits, draft[key].calendar)) {
      setError('생년월일을 다시 확인해 주세요. 실제로 있는 날짜 여덟 자리가 필요합니다.');
      return;
    }
    setError('');
    advance();
  };

  const selectCalendar = (key: PersonKey, calendar: ReunionPersonDraft['calendar']) => {
    const digits = dateDigits[key];
    patchPerson(key, {
      calendar,
      isLeapMonth: calendar === 'solar' ? false : draft[key].isLeapMonth,
      birthDate: toIsoBirthDate(digits, calendar)
    });
    if (isBirthDigitsReady(digits, calendar)) {
      setError('');
      advance();
    }
  };

  /* ── 시각 ────────────────────────────────────────────────────────── */

  const syncClock = (key: PersonKey, next: ClockDraft) => {
    setClock((current) => ({ ...current, [key]: next }));
    const value = toClockValue(next);
    patchPerson(key, { birthTime: value, isUnknownTime: false });
    return value;
  };

  const selectPeriod = (key: PersonKey, period: Exclude<ClockPeriod, ''>) => {
    const next = { ...clock[key], period };
    if (syncClock(key, next)) {
      advance();
      return;
    }
    window.requestAnimationFrame(() => hourRef.current?.focus());
  };

  const handleHourChange = (key: PersonKey, raw: string) => {
    const digits = clockDigits(raw);
    syncClock(key, { ...clock[key], hour: digits });
    const hour = Number(digits);
    if (digits.length === 2 && hour >= 1 && hour <= 12) {
      window.requestAnimationFrame(() => minuteRef.current?.focus());
    }
  };

  const handleMinuteChange = (key: PersonKey, raw: string) => {
    const digits = clockDigits(raw);
    if (syncClock(key, { ...clock[key], minute: digits }) && digits.length === 2) {
      setError('');
      advance();
    }
  };

  /* blur 에서는 값만 채우고 넘기지 않는다. blur 가 '다음' 클릭으로 발생할 수 있고,
     거기서 한 걸음 더 나가면 클릭 한 번에 두 걸음이 지나간다. */
  const completeMinute = (key: PersonKey, thenAdvance: boolean) => {
    const minute = clock[key].minute;
    if (!minute) return;
    const padded = minute.length === 1 ? minute.padStart(2, '0') : minute;
    if (syncClock(key, { ...clock[key], minute: padded }) && thenAdvance) {
      setError('');
      advance();
    }
  };

  const selectUnknownTime = (key: PersonKey) => {
    setClock((current) => ({ ...current, [key]: EMPTY_CLOCK }));
    patchPerson(key, { birthTime: '', isUnknownTime: true });
    setError('');
    advance();
  };

  /* ── 마지막 연락일(선택) ─────────────────────────────────────────── */

  const handleContactDateChange = (raw: string) => {
    const digits = birthDigits(raw);
    setContactDigits(digits);
    updateDraft('lastContactAt', digits.length === 8 && isNotFuture(digits) ? toIsoBirthDate(digits) : '');
  };

  const contactDateBroken = contactDigits.length > 0 && !draft.lastContactAt;

  /* ── 걸음별 준비 여부 ────────────────────────────────────────────── */

  const stepReady = useMemo(() => {
    switch (step) {
      case 1:
        return isBirthDigitsReady(dateDigits.self, draft.self.calendar);
      case 2:
        return draft.self.isUnknownTime || Boolean(draft.self.birthTime);
      case 3:
        return draft.self.gender === 'male' || draft.self.gender === 'female';
      case 4:
        return Boolean(draft.self.name.trim());
      case 5:
        return draft.consentToUsePartnerData;
      case 6:
        return Boolean(draft.partner.name.trim()) &&
          (draft.partner.gender === 'male' || draft.partner.gender === 'female');
      case 7:
        return isBirthDigitsReady(dateDigits.partner, draft.partner.calendar);
      case 8:
        return draft.partner.isUnknownTime || Boolean(draft.partner.birthTime);
      case 9:
        return Boolean(draft.breakupDuration);
      case 10:
        return Boolean(draft.contactStatus);
      case 11:
        /* 비워 두는 것이 정답일 수 있는 걸음이다. 여덟 자리를 반쯤 적어 둔
           상태만 막는다 — 그대로 넘기면 적은 값이 조용히 버려진다. */
        return !contactDateBroken;
      case 12:
        return Boolean(draft.desiredOutcome);
      default:
        return draft.breakupReason.trim().length >= 4 && draft.question.trim().length >= 8;
    }
  }, [contactDateBroken, dateDigits, draft, step]);

  const validateCurrentStep = () => {
    /* 한 사람의 장이 끝나는 걸음에서만 전체 출생 정보를 검증한다.
       이름이 마지막에 오므로 그 전에는 name 필수 오류가 항상 걸린다. */
    const closing: Partial<Record<IntakeStep, PersonKey>> = { 4: 'self', 8: 'partner' };
    const subject = closing[step];

    if (subject) {
      const result = validateBirthInput(personValidationInput(draft[subject]), {
        subjectLabel: subject === 'self' ? '본인' : '상대방'
      });
      if (!result.valid) {
        const first = result.errors[0];
        setError(first?.message || '출생 정보를 다시 확인해 주세요.');
        if (first) setStep(stepForField(first.field, subject));
        return false;
      }
    }

    if (step === 5 && !draft.consentToUsePartnerData) {
      setError('상대방 출생 정보 이용을 직접 확인해 주셔야 다음으로 넘어갑니다.');
      return false;
    }

    if (step === LAST_STEP) {
      if (draft.breakupReason.trim().length < 4) {
        setError('헤어지게 된 배경을 확인된 사실 위주로 4자 이상 적어주세요.');
        return false;
      }
      if (draft.question.trim().length < 8) {
        setError('가장 궁금한 내용을 8자 이상 적어주세요.');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!stepReady || !validateCurrentStep()) return;

    if (step < LAST_STEP) {
      advance();
      return;
    }

    try {
      const formData = createReunionFormData(draft);
      const reunionContext = buildContext(draft);
      const contextValidation = validateReunionContext(reunionContext);

      if (!contextValidation.valid) {
        const first = contextValidation.errors[0];
        setError(first?.message || '이별 이후의 상황을 다시 확인해 주세요.');
        if (first?.field === 'consentToUsePartnerData') setStep(5);
        if (first?.field === 'breakupDuration') setStep(9);
        if (first?.field === 'contactStatus') setStep(10);
        if (first?.field === 'lastContactAt') setStep(11);
        if (first?.field === 'desiredOutcome') setStep(12);
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
    goTo((step - 1) as IntakeStep);
  };

  const resetDraft = () => {
    setDraft(createEmptyReunionDraft());
    setDateDigits({ self: '', partner: '' });
    setClock({ self: EMPTY_CLOCK, partner: EMPTY_CLOCK });
    setContactDigits('');
    setNotesOpen(false);
    setStep(1);
    setError('');
  };

  const onEnterAdvance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && stepReady) {
      event.preventDefault();
      handleNext();
    }
  };

  /* ── 조각 ────────────────────────────────────────────────────────── */

  const calendarPills = (key: PersonKey) => (
    <div className="ri-pills" role="group" aria-label="양력 또는 음력 선택">
      {([['solar', '양력'], ['lunar', '음력']] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          className="ud-pressable ud-selectable"
          aria-pressed={draft[key].calendar === value}
          onClick={() => selectCalendar(key, value)}
        >
          {label}
        </button>
      ))}
      {draft[key].calendar === 'lunar' ? (
        <button
          type="button"
          className="ud-pressable"
          aria-pressed={draft[key].isLeapMonth}
          onClick={() => {
            const next = !draft[key].isLeapMonth;
            updatePerson(key, 'isLeapMonth', next);
          }}
        >
          윤달
        </button>
      ) : null}
    </div>
  );

  const birthDateStep = (key: PersonKey) => (
    <div className="ri-fields ud-step" style={rise(1)}>
      {calendarPills(key)}
      <label className="ri-line" data-kind="date">
        <span className="ud-sr">{key === 'self' ? '나의' : '그 사람의'} 생년월일 여덟 자리</span>
        <input
          autoFocus
          type="text"
          data-type-scale="own"
          {...invalidProps}
          inputMode="numeric"
          enterKeyHint="next"
          autoComplete={key === 'self' ? 'bday' : 'off'}
          maxLength={10}
          value={displayBirthDigits(dateDigits[key])}
          placeholder="1995.10.15"
          onChange={(event) => handleDateChange(key, event.target.value)}
          onKeyDown={onEnterAdvance}
        />
      </label>
      <p className="ri-hint">
        {draft[key].calendar === 'lunar'
          ? '음력으로 적은 날짜는 계산 전에 양력으로 환산합니다.'
          : '주민등록상 생일이 아니라 실제로 태어난 날을 적어 주세요.'}
      </p>
    </div>
  );

  const birthTimeStep = (key: PersonKey) => (
    <div className="ri-fields ud-step" style={rise(1)}>
      <div className="ri-pills" role="group" aria-label="오전 또는 오후 선택">
        {([['am', '오전'], ['pm', '오후']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="ud-pressable ud-selectable"
            aria-pressed={clock[key].period === value}
            onClick={() => selectPeriod(key, value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ri-clock">
        <label className="ri-line">
          <span className="ud-sr">태어난 시, 1부터 12</span>
          <input
            ref={hourRef}
            autoFocus={!clock[key].period}
            type="text"
            data-type-scale="own"
            {...invalidProps}
            inputMode="numeric"
            enterKeyHint="next"
            maxLength={2}
            value={clock[key].hour}
            placeholder="09"
            onChange={(event) => handleHourChange(key, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                minuteRef.current?.focus();
              }
            }}
          />
          <b>시</b>
        </label>
        <i aria-hidden="true">:</i>
        <label className="ri-line">
          <span className="ud-sr">태어난 분, 0부터 59</span>
          <input
            ref={minuteRef}
            type="text"
            data-type-scale="own"
            {...invalidProps}
            inputMode="numeric"
            enterKeyHint="next"
            maxLength={2}
            value={clock[key].minute}
            placeholder="30"
            onChange={(event) => handleMinuteChange(key, event.target.value)}
            onBlur={() => completeMinute(key, false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                completeMinute(key, true);
              }
            }}
          />
          <b>분</b>
        </label>
      </div>
      <button
        type="button"
        className="ri-quiet ud-pressable"
        aria-pressed={draft[key].isUnknownTime}
        onClick={() => selectUnknownTime(key)}
      >
        {draft[key].isUnknownTime ? <Check size={16} aria-hidden="true" /> : null}
        태어난 시간을 몰라요
      </button>
      <p className="ri-hint">시간을 모르면 시주를 빼고, 그 없이도 확인되는 범위만 씁니다.</p>
    </div>
  );

  const genderStep = (key: PersonKey) => (
    <div className="ri-choice ud-step" style={rise(1)} role="group" aria-label="성별 선택">
      {([['female', '여성'], ['male', '남성']] as const).map(([value, label], index) => (
        <button
          key={value}
          type="button"
          className="ud-pressable ud-selectable"
          style={rise(index + 2)}
          aria-pressed={draft[key].gender === value}
          onClick={() => {
            updatePerson(key, 'gender', value);
            if (key === 'self') {
              setError('');
              advance();
            }
          }}
        >
          <span><strong>{label}</strong></span>
          <i aria-hidden="true">{draft[key].gender === value ? <Check size={14} /> : null}</i>
        </button>
      ))}
    </div>
  );

  const choiceList = <T extends string>(
    options: readonly (readonly [T, string, string?])[],
    selected: T,
    onPick: (value: T) => void,
    label: string,
    cols?: '2'
  ) => (
    <div className="ri-choice ud-step" style={rise(1)} data-cols={cols} role="group" aria-label={label}>
      {options.map(([value, text, detail], index) => (
        <button
          key={value}
          type="button"
          className="ud-pressable ud-selectable"
          style={rise(index + 2)}
          aria-pressed={selected === value}
          onClick={() => {
            onPick(value);
            setError('');
            advance();
          }}
        >
          <span>
            <strong>{text}</strong>
            {detail ? <small>{detail}</small> : null}
          </span>
          <i aria-hidden="true">{selected === value ? <Check size={14} /> : null}</i>
        </button>
      ))}
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return birthDateStep('self');
      case 2:
        return birthTimeStep('self');
      case 3:
        return genderStep('self');
      case 4:
        return (
          <div className="ri-fields ud-step" style={rise(1)}>
            <div className="ri-name-row">
              <label className="ri-line" data-kind="name">
                <span className="ud-sr">나의 이름 또는 호칭</span>
                <input
                  autoFocus
                  type="text"
                  data-type-scale="own"
                  {...invalidProps}
                  autoComplete="name"
                  enterKeyHint="next"
                  maxLength={20}
                  value={draft.self.name}
                  placeholder="지윤"
                  onChange={(event) => updatePerson('self', 'name', event.target.value)}
                  onKeyDown={onEnterAdvance}
                />
              </label>
              <button
                type="button"
                className="ri-quiet ud-pressable"
                disabled={!draft.self.name.trim()}
                onClick={handleNext}
              >
                <Check size={16} aria-hidden="true" />
                확인
              </button>
            </div>
            <p className="ri-hint">이름은 리포트 안에서만 씁니다. 공유용 문구에는 들어가지 않아요.</p>
          </div>
        );
      case 5:
        return (
          <div className="ri-fields ud-step" style={rise(1)}>
            <h2 className="ud-sr">상대방 정보 이용 확인</h2>
            <ul className="ri-consent-list">
              <li style={rise(2)} className="ud-step">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <b>받는 것</b>
                  그 사람의 생년월일과 태어난 시간, 성별, 리포트에서 부를 호칭.
                </span>
              </li>
              <li style={rise(3)} className="ud-step" data-tone="deny">
                <ShieldOff size={18} aria-hidden="true" />
                <span>
                  <b>받지 않는 것</b>
                  연락처와 주소, 사진, 두 사람이 나눈 대화. 입력란 자체가 없습니다.
                </span>
              </li>
              <li style={rise(4)} className="ud-step">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <b>두는 곳</b>
                  지금 이 브라우저 세션에만 임시로 두고, 24시간이 지나면 지웁니다.
                </span>
              </li>
            </ul>
            <label className="ri-consent ud-step" style={rise(5)}>
              <input
                type="checkbox"
                checked={draft.consentToUsePartnerData}
                onChange={(event) => updateDraft('consentToUsePartnerData', event.target.checked)}
              />
              <span>
                <strong>그 사람의 출생 정보를 이 리포트에 쓰는 것을 제가 확인했습니다.</strong>
                <small>
                  그 사람이 직접 알려준 정보이거나 이용에 동의한 정보만 입력합니다.
                  확인하지 않으면 다음으로 넘어가지 않습니다.
                </small>
              </span>
            </label>
          </div>
        );
      case 6:
        return (
          <div className="ri-fields ud-step" style={rise(1)}>
            <label className="ri-line" data-kind="name">
              <span className="ud-sr">그 사람의 호칭</span>
              <input
                autoFocus
                type="text"
                data-type-scale="own"
                {...invalidProps}
                autoComplete="off"
                enterKeyHint="next"
                maxLength={20}
                value={draft.partner.name}
                placeholder="그 사람"
                onChange={(event) => updatePerson('partner', 'name', event.target.value)}
                onKeyDown={onEnterAdvance}
              />
            </label>
            {genderStep('partner')}
          </div>
        );
      case 7:
        return birthDateStep('partner');
      case 8:
        return birthTimeStep('partner');
      case 9:
        return choiceList(
          (Object.entries(breakupDurationLabels) as [ReunionContext['breakupDuration'], string][])
            .map(([value, text]) => [value, text] as const),
          draft.breakupDuration,
          (value) => updateDraft('breakupDuration', value),
          '헤어진 후 지난 기간',
          '2'
        );
      case 10:
        return choiceList(
          (Object.entries(contactStatusLabels) as [ReunionContext['contactStatus'], string][])
            .map(([value, text]) => [value, text, CONTACT_DETAIL[value]] as const),
          draft.contactStatus,
          (value) => updateDraft('contactStatus', value),
          '현재 연락 상태'
        );
      case 11:
        return (
          <div className="ri-fields ud-step" style={rise(1)}>
            <label className="ri-line" data-kind="date">
              <span className="ud-sr">마지막으로 연락한 날 여덟 자리, 선택 항목</span>
              <input
                autoFocus
                type="text"
                data-type-scale="own"
                {...invalidProps}
                inputMode="numeric"
                enterKeyHint="next"
                maxLength={10}
                value={displayBirthDigits(contactDigits)}
                placeholder="2026.03.01"
                onChange={(event) => handleContactDateChange(event.target.value)}
                onKeyDown={onEnterAdvance}
              />
            </label>
            <button
              type="button"
              className="ri-quiet ud-pressable"
              onClick={() => {
                setContactDigits('');
                updateDraft('lastContactAt', '');
                setError('');
                advance();
              }}
            >
              기억나지 않아요 · 건너뛰기
            </button>
            <p className="ri-hint">
              {contactDateBroken
                ? '여덟 자리를 모두 적고 오늘보다 앞선 날짜여야 반영됩니다.'
                : '침묵의 길이를 재는 데만 씁니다. 연락을 재촉하는 근거로는 쓰지 않아요.'}
            </p>
          </div>
        );
      case 12:
        return choiceList(
          (Object.entries(desiredOutcomeLabels) as [ReunionContext['desiredOutcome'], string][])
            .map(([value, text]) => [value, text, OUTCOME_DETAIL[value]] as const),
          draft.desiredOutcome,
          (value) => updateDraft('desiredOutcome', value),
          '이번 리포트로 얻고 싶은 것'
        );
      default:
        return (
          <div className="ri-fields ud-step" style={rise(1)}>
            <label className="ri-scribe ud-step" style={rise(2)}>
              <span className="ri-scribe-head">
                <span>헤어지게 된 배경 <em>필수</em></span>
                <span className="ri-scribe-count">{draft.breakupReason.length}/300</span>
              </span>
              <textarea
                autoFocus
                data-type-scale="own"
                {...invalidProps}
                rows={4}
                maxLength={300}
                value={draft.breakupReason}
                placeholder="확인된 사실 위주로 적어주세요. 추측한 상대의 마음은 리포트에서 따로 구분합니다."
                onChange={(event) => updateDraft('breakupReason', event.target.value)}
              />
            </label>
            <label className="ri-scribe ud-step" style={rise(3)}>
              <span className="ri-scribe-head">
                <span>가장 궁금한 한 가지 <em>최소 8자</em></span>
                <span className="ri-scribe-count">{draft.question.length}/300</span>
              </span>
              <textarea
                data-type-scale="own"
                {...invalidProps}
                rows={5}
                maxLength={300}
                value={draft.question}
                placeholder="예: 한 달째 연락하지 않고 있어요. 먼저 안부를 물어도 될지, 기다린다면 어떤 신호를 봐야 할지 알고 싶어요."
                onChange={(event) => updateDraft('question', event.target.value)}
              />
            </label>
            {notesOpen ? (
              <label className="ri-scribe ud-step" style={rise(4)}>
                <span className="ri-scribe-head">
                  <span>리포트에 반영할 추가 상황 <em>선택</em></span>
                  <span className="ri-scribe-count">{draft.notes.length}/300</span>
                </span>
                <textarea
                  autoFocus
                  data-type-scale="own"
                  {...invalidProps}
                  rows={3}
                  maxLength={300}
                  value={draft.notes}
                  placeholder="공동 일정이나 돌려받을 물건처럼 현실적으로 고려할 내용을 적어주세요."
                  onChange={(event) => updateDraft('notes', event.target.value)}
                />
              </label>
            ) : (
              <button
                type="button"
                className="ri-quiet ud-pressable"
                aria-expanded={false}
                onClick={() => setNotesOpen(true)}
              >
                더 적을 상황이 있어요 (선택)
              </button>
            )}
          </div>
        );
    }
  };

  /* 원장은 두 사람의 값을 넣고 확인하는 걸음에서만 쓸모가 있다. 동의 걸음에서는
     읽어야 할 문장이 가장 중요하므로 치운다. */
  const showLedger = step > 1 && step !== 5;

  return (
    <main
      className="reunion-page reunion-intake-page ud-grain ud-vignette"
      data-chapter={chapterId}
    >
      <UdOrnamentDefs />

      <div className="ri-stage" aria-hidden="true">
        {STAGE_SHOTS.map((key) => {
          const art = reunionPanelImages[key];
          const active = key === meta.shot;
          return (
            <img
              key={key}
              className="ri-stage-shot"
              data-active={active}
              src={art.src}
              srcSet={art.srcSet}
              sizes={art.sizes}
              alt=""
              decoding="async"
              loading={key === 'reflect' ? 'eager' : 'lazy'}
            />
          );
        })}
        <span className="ri-stage-scrim" />
      </div>

      <header className="reunion-intake-header">
        <button
          type="button"
          onClick={handleBack}
          aria-label={step === 1 ? '재회운 소개로 돌아가기' : '이전 단계'}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <strong>운월당 재회운</strong>
        <button type="button" onClick={resetDraft} aria-label="입력 내용 초기화">
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </header>

      <div className="ri-rail-band">
        <ol className="ri-rail" role="list" aria-label="입력 진행">
          {CHAPTERS.map((entry) => {
            const state = entry.id < chapterId ? 'done' : entry.id === chapterId ? 'current' : 'todo';
            return (
              <li key={entry.id} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="ri-rail-num" aria-hidden="true">{entry.numeral}</span>
                {state === 'current' ? <span className="ri-rail-name">{entry.name}</span> : null}
                <span className="ud-sr">
                  {`${entry.id}장 ${entry.name}`}
                  {state === 'done' ? ' 완료' : state === 'current' ? ' 진행 중' : ''}
                </span>
                {state === 'current' ? (
                  <span className="ri-rail-dots" aria-hidden="true">
                    {entry.steps.map((value) => <i key={value} data-on={value <= step} />)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* 리마운트 바깥에 두어야 단계 변경이 실제로 읽힌다. */}
      <p className="ud-sr" role="status">
        {`${chapter.numeral}장 ${chapter.name} · 전체 ${TOTAL_STEPS}단계 중 ${step}단계`}
      </p>

      {/* 아트 창. 액자로 읽히도록 네 귀에 뇌문을 놓는다(상세페이지의 컷 무대와 같은 어휘). */}
      <div className="ri-window" aria-hidden="true">
        <UdCorners kind="fret" size={22} inset={8} className="ri-window-corners" />
      </div>

      <section
        key={step}
        ref={panelRef}
        className="ri-panel ud-step"
        aria-labelledby="reunion-step-title"
      >
        {/* 세 화면이 공유해야 하는 최소 장식 세트 중 머리 장치.
            이전 판의 입력창에는 상세페이지를 정의하는 뇌문 코너 · 현판 · 메달리온이
            하나도 없어서(실측 0/0/0), 같은 제품으로 읽히지 않았다.
            코너는 판이 내부 스크롤이라 여기 두지 않는다 — 스크롤과 함께 흘러간다.
            고정되어 있는 상단바와 아트 창이 코너를 맡는다. */}
        <span className="ri-panel-crest" aria-hidden="true">
          <i className="ri-panel-rule" />
          <UdMedallion glyph="seal" size={32} />
          <i className="ri-panel-rule" />
        </span>

        {showLedger ? (
          <dl className="ri-ledger">
            {([['self', '나'], ['partner', '그 사람']] as const).map(([key, label], index) => {
              const name = draft[key].name.trim();
              const summary = ledgerSummary(draft[key]);
              return (
                <div key={key} data-live={chapterId === index + 1}>
                  <dt>{label}</dt>
                  {/* 이름을 아직 묻지 않은 걸음에서 '—' 를 굵게 세우면 오류처럼 읽힌다.
                      있는 값을 주역으로 올리고, 아무것도 없을 때만 '—' 가 남는다. */}
                  <dd>
                    {name || summary}
                    {name ? <span>{summary}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}

        <p className="ri-kicker ud-kicker">
          <UdGlyph name={meta.glyph} size={18} />
          <em>{chapter.numeral}</em>
          {chapter.name}
          <s aria-hidden="true" />
        </p>

        {/* tabIndex={-1} 은 걸음 전환 시 포커스를 받기 위한 것이다(위 이펙트 참조).
            탭 순서에는 들어가지 않는다. */}
        <h1 className="ri-title" id="reunion-step-title" ref={titleRef} tabIndex={-1}>
          {meta.title}
        </h1>

        <UdBubble className="ri-voice" tail="left">{meta.guide}</UdBubble>

        {renderStep()}

        <p className="ri-error" id={ERROR_ID} role="alert" aria-live="assertive">{error}</p>
      </section>

      <footer className="reunion-intake-actions">
        <button type="button" className="ri-back ud-pressable" onClick={handleBack}>
          <ArrowLeft size={15} aria-hidden="true" />
          이전
        </button>
        <button
          type="button"
          className="ri-next ud-pressable"
          disabled={!stepReady}
          onClick={handleNext}
        >
          <UdCartouche tone="cta">
            {step === LAST_STEP ? <Sparkles size={17} aria-hidden="true" /> : null}
            {step === LAST_STEP ? '무료 미리보기 보기' : '다음'}
            {step === LAST_STEP ? null : <ArrowRight size={17} aria-hidden="true" />}
          </UdCartouche>
        </button>
      </footer>
    </main>
  );
}
