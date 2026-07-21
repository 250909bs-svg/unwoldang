import { Check, ChevronDown, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  type IntakeFormData,
  type LoveReaction,
  type PartnerBirthData,
  type RelationshipStatus,
  findServiceById
} from '../api/mockData';
import { useAuth } from '../context/AuthContext';
import {
  PAST_LIFE_PRODUCT,
  pastLifeSymbolOptions,
  pastLifeToneOptions,
  pastLifeTopicOptions
} from '../content/pastLifeExperience';
import { validateBirthInput } from '../lib/birthInputValidation';
import { MZ_LOVE_CHOICE_STORAGE_KEY, normalizeLoveReaction } from '../lib/mz-love-fact/microChoice';
import { isRelationshipDurationRequired } from '../lib/relationshipIntake';
import GeneralSignaturePolicyNotice from '../products/general-signature/components/GeneralSignaturePolicyNotice';
import {
  applyGeneralSignatureCalendarSelection,
  formatGeneralSignatureBirthDate,
  GENERAL_SIGNATURE_PRODUCT,
  isGeneralSignatureRelationshipReady,
  normalizeGeneralSignatureBirthFields
} from '../products/general-signature';
import { getProductById } from '../products/registry';
import '../styles/mz-love-fact.css';
import '../styles/past-life.css';

const initialState: IntakeFormData = {
  name: '',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  birthTimePrecision: 'branch-range',
  dayBoundaryPolicy: 'midnight',
  relationshipStatus: '',
  relationshipDuration: '',
  location: '',
  q1: '',
  q2: '',
  pastLifeTopic: '',
  repeatedScene: '',
  frequentEmotion: '',
  hiddenDesire: '',
  chosenSymbol: '',
  readingTone: '균형 있게'
};

const emptyPartnerBirthData: PartnerBirthData = {
  name: '',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '',
  birthTime: '',
  isUnknownTime: false,
  birthTimePrecision: 'branch-range',
  dayBoundaryPolicy: 'midnight'
};

type IntakeStep = 1 | 2 | 3 | 4;

const pastLifeGuideStepCopy: Record<IntakeStep, { eyebrow: string; line: string }> = {
  1: {
    eyebrow: '첫 번째 봉인',
    line: '먼저 네 이름과 태어난 때를 알려줘. 장부 속 흔적의 주인부터 정확히 맞출게.'
  },
  2: {
    eyebrow: '두 번째 봉인',
    line: '지금 가장 마음에 걸리는 걸 하나만 골라. 그 질문부터 따라갈 거야.'
  },
  3: {
    eyebrow: '세 번째 봉인',
    line: '이번엔 꾸미지 말고 적어. 또 시작됐다고 느끼는 장면과 그때의 감정, 사실 바라는 결말.'
  },
  4: {
    eyebrow: '마지막 봉인',
    line: '마지막이야. 눈이 먼저 머무는 상징과 내가 어떤 온도로 말해주면 좋을지 골라.'
  }
};

const pastLifeToneReplies: Record<string, string> = {
  따뜻하게: '좋아. 아픈 대목도 다그치지 않고, 네가 받아들일 수 있는 속도로 읽어줄게.',
  직설적으로: '좋아. 돌려 말하지 않고, 지금 끊어야 할 반복부터 바로 짚어줄게.',
  '균형 있게': '좋아. 서사는 깊게 읽되, 현실에서 확인할 근거와 행동까지 함께 보여줄게.'
};

type FormLocationState = {
  formData?: Partial<IntakeFormData>;
  loveReaction?: LoveReaction;
  tabOrigin?: string;
  recoveredEntitlement?: {
    orderId: string;
    reportAccessToken: string;
  };
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

const birthLocationOptions = [
  { label: '지역 모름 · 보정 안 함', latitude: undefined, longitude: undefined },
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

const loveReadingQuestionSuggestions = {
  q1: [
    '지금 반복되는 애매한 관계를 계속 이어가도 될까요?',
    '왜 저는 확신을 늦게 주는 사람에게 더 끌릴까요?',
    '다음 연애에서 꼭 피해야 할 제 반복 패턴은 무엇인가요?'
  ],
  q2: [
    '앞으로 12개월 중 새 인연을 만나기 좋은 흐름은 언제인가요?',
    '지금 상대와 오래 가려면 어떤 행동을 먼저 확인해야 하나요?',
    '연락·약속·표현 중 제가 먼저 바꿔야 할 한 가지는 무엇인가요?'
  ]
} as const;

const pastLifeQuestionSuggestions = {
  q1: [
    '제가 반복해서 겪는 관계 패턴은 전생 서사에서 어떻게 읽히나요?',
    '사주에 남은 전생의 재능은 현생에서 어떤 일로 살릴 수 있나요?',
    '이유 없이 익숙하거나 끌리는 장소와 사람의 공통점은 무엇인가요?'
  ],
  q2: [
    '전생에서 이어진 습관 중 지금 내려놓아야 할 것은 무엇인가요?',
    '현생에서 반드시 풀어야 할 가장 중요한 과제는 무엇인가요?',
    '앞으로 90일 동안 전생의 장점을 현실에서 쓰는 방법을 알려주세요.'
  ]
} as const;

const relationshipStatusOptions = [
  { value: 'single', label: '솔로', body: '지금은 특정 상대 없이 다음 인연과 내 연애 패턴이 궁금해요.' },
  { value: 'situationship', label: '썸 타는 중', body: '호감은 오가지만 아직 관계를 정하지 않았어요.' },
  { value: 'dating', label: '연애 중', body: '현재 만나고 있는 사람과의 흐름이 궁금해요.' },
  { value: 'ambiguous', label: '관계가 애매함', body: '연락과 감정선은 있지만 상대와의 정의가 모호해요.' },
  { value: 'breakup-reunion', label: '이별·재회 고민', body: '헤어진 인연을 정리할지 다시 볼지 고민 중이에요.' },
  { value: 'married', label: '기혼', body: '배우자와의 관계 흐름과 앞으로의 균형을 보고 싶어요.' }
] as const satisfies ReadonlyArray<{
  value: Exclude<RelationshipStatus, ''>;
  label: string;
  body: string;
}>;

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
  birthTimePrecision:
    source?.birthTimePrecision ||
    (source?.isUnknownTime ? 'unknown' : /^\d{1,2}:\d{2}$/.test(source?.birthTime || '') ? 'exact' : 'branch-range'),
  dayBoundaryPolicy: source?.dayBoundaryPolicy || 'midnight',
  birthLocation: source?.birthLocation,
  partner: source?.partner ? { ...emptyPartnerBirthData, ...source.partner } : undefined,
  relationshipStatus: source?.relationshipStatus ?? '',
  relationshipDuration: source?.relationshipDuration ?? '',
  loveReaction: normalizeLoveReaction(source?.loveReaction) ?? undefined,
  location: source?.location ?? '',
  q1: source?.q1 ?? '',
  q2: source?.q2 ?? '',
  pastLifeTopic: source?.pastLifeTopic ?? '',
  repeatedScene: source?.repeatedScene ?? '',
  frequentEmotion: source?.frequentEmotion ?? '',
  hiddenDesire: source?.hiddenDesire ?? '',
  chosenSymbol: source?.chosenSymbol ?? '',
  readingTone: source?.readingTone ?? '균형 있게'
});

function getBirthTimeSelectValue(formData: IntakeFormData) {
  if (formData.isUnknownTime) {
    return '';
  }

  return birthTimeOptions.find((option) => option.birthTime === formData.birthTime)?.value || '';
}

function getExactBirthTimeValue(formData: IntakeFormData) {
  if (formData.isUnknownTime || formData.birthTimePrecision !== 'exact') {
    return '';
  }

  const match = formData.birthTime.match(/^(\d{1,2}):(\d{2})$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

function getPartnerBirthTimeSelectValue(partner: PartnerBirthData) {
  if (partner.isUnknownTime || partner.birthTimePrecision === 'exact') {
    return '';
  }

  return birthTimeOptions.find((option) => option.birthTime === partner.birthTime)?.value || '';
}

function getPartnerExactBirthTimeValue(partner: PartnerBirthData) {
  if (partner.isUnknownTime || partner.birthTimePrecision !== 'exact') {
    return '';
  }

  const match = partner.birthTime.match(/^(\d{1,2}):(\d{2})$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

export default function Form() {
  const { id } = useParams<{ id: string }>();
  const product = getProductById(id)!;
  const service = findServiceById(product.id);
  const isGeneralSignatureFlow = product.flow.detailVariant === 'general-signature';
  const isPastLifeFlow = product.flow.intakeVariant === 'past-life';
  const isCompatibilityFlow = product.flow.intakeVariant === 'compatibility';
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const locationState = (location.state as FormLocationState | null) ?? null;
  const tabOrigin = locationState?.tabOrigin || '/';
  const draftKey = useMemo(() => `unwoldang.intake.${service.id}`, [service.id]);
  const [step, setStep] = useState<IntakeStep>(1);
  const [formData, setFormData] = useState<IntakeFormData>(initialState);
  const [birthDigits, setBirthDigits] = useState('');
  const [partnerBirthDigits, setPartnerBirthDigits] = useState('');
  const partnerData = formData.partner || emptyPartnerBirthData;

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

    const source = locationState?.formData ?? draft;
    const storedLoveReaction = service.id === 'love-reading'
      ? window.sessionStorage.getItem(MZ_LOVE_CHOICE_STORAGE_KEY)
      : null;
    const hydrationSource = {
      ...source,
      loveReaction:
        normalizeLoveReaction(locationState?.loveReaction) ??
        normalizeLoveReaction(source?.loveReaction) ??
        normalizeLoveReaction(storedLoveReaction) ??
        undefined
    };
    const hydrated = hydrateFormData(
      isGeneralSignatureFlow
        ? normalizeGeneralSignatureBirthFields(hydrationSource)
        : hydrationSource
    );

    setFormData(hydrated);
    setBirthDigits(parseDateDigits(hydrated.birthDate));
    setPartnerBirthDigits(parseDateDigits(hydrated.partner?.birthDate));
  }, [draftKey, isGeneralSignatureFlow, locationState?.formData, locationState?.loveReaction, service.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(draftKey, JSON.stringify(formData));
  }, [draftKey, formData]);

  const updateField = <K extends keyof IntakeFormData>(name: K, value: IntakeFormData[K]) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const selectRelationshipStatus = (relationshipStatus: Exclude<RelationshipStatus, ''>) => {
    setFormData((prev) => ({
      ...prev,
      relationshipStatus,
      relationshipDuration: relationshipStatus === 'single' ? '' : prev.relationshipDuration
    }));
  };

  const updateBirthDate = (value: string) => {
    const nextDigits = sanitizeDigits(value, 8);
    setBirthDigits(nextDigits);
    updateField(
      'birthDate',
      isGeneralSignatureFlow
        ? formatGeneralSignatureBirthDate(nextDigits, formData.calendar)
        : formatBirthDate(nextDigits)
    );
  };

  const selectBirthCalendar = (calendar: IntakeFormData['calendar']) => {
    if (isGeneralSignatureFlow) {
      setFormData((prev) => applyGeneralSignatureCalendarSelection(prev, birthDigits, calendar));
      return;
    }

    updateField('calendar', calendar);

    if (calendar === 'solar') {
      updateField('isLeapMonth', false);
    }
  };

  const updateBirthTime = (nextValue: string) => {
    const selected = birthTimeOptions.find((option) => option.value === nextValue);

    if (!selected) {
      updateField('isUnknownTime', false);
      updateField('birthTime', '');
      updateField('birthTimePrecision', 'branch-range');
      return;
    }

    if (selected.value === 'unknown') {
      updateField('isUnknownTime', true);
      updateField('birthTime', '');
      updateField('birthTimePrecision', 'unknown');
      return;
    }

    updateField('isUnknownTime', false);
    updateField('birthTime', selected.birthTime);
    updateField('birthTimePrecision', 'branch-range');
  };

  const updateExactBirthTime = (value: string) => {
    updateField('isUnknownTime', false);
    updateField('birthTime', value);
    updateField('birthTimePrecision', value ? 'exact' : 'branch-range');
  };

  const updateBirthLocation = (label: string) => {
    const selected = birthLocationOptions.find((option) => option.label === label);

    setFormData((prev) => ({
      ...prev,
      location: selected?.latitude === undefined ? '' : selected.label,
      birthLocation:
        selected?.latitude === undefined || selected.longitude === undefined
          ? undefined
          : {
              label: selected.label,
              latitude: selected.latitude,
              longitude: selected.longitude,
              timezone: 'Asia/Seoul',
              utcOffsetMinutes: 540,
              applySolarTimeCorrection: true
            }
    }));
  };

  const updatePartnerField = <K extends keyof PartnerBirthData>(name: K, value: PartnerBirthData[K]) => {
    setFormData((prev) => ({
      ...prev,
      partner: {
        ...emptyPartnerBirthData,
        ...prev.partner,
        [name]: value
      }
    }));
  };

  const updatePartnerBirthLocation = (label: string) => {
    const selected = birthLocationOptions.find((option) => option.label === label);

    updatePartnerField(
      'birthLocation',
      selected?.latitude === undefined || selected.longitude === undefined
        ? undefined
        : {
            label: selected.label,
            latitude: selected.latitude,
            longitude: selected.longitude,
            timezone: 'Asia/Seoul',
            utcOffsetMinutes: 540,
            applySolarTimeCorrection: true
          }
    );
  };

  const updatePartnerBirthDate = (value: string) => {
    const digits = sanitizeDigits(value, 8);
    setPartnerBirthDigits(digits);
    updatePartnerField('birthDate', formatBirthDate(digits));
  };

  const updatePartnerExactBirthTime = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      partner: {
        ...emptyPartnerBirthData,
        ...prev.partner,
        birthTime: value,
        isUnknownTime: false,
        birthTimePrecision: value ? 'exact' : 'branch-range'
      }
    }));
  };

  const updatePartnerBirthTime = (nextValue: string) => {
    const selected = birthTimeOptions.find((option) => option.value === nextValue);

    setFormData((prev) => ({
      ...prev,
      partner: {
        ...emptyPartnerBirthData,
        ...prev.partner,
        birthTime: selected && selected.value !== 'unknown' ? selected.birthTime : '',
        isUnknownTime: selected?.value === 'unknown',
        birthTimePrecision: selected?.value === 'unknown' ? 'unknown' : 'branch-range'
      }
    }));
  };

  const togglePartnerUnknownBirthTime = () => {
    setFormData((prev) => {
      const partner = { ...emptyPartnerBirthData, ...prev.partner };
      const nextUnknown = !partner.isUnknownTime;

      return {
        ...prev,
        partner: {
          ...partner,
          isUnknownTime: nextUnknown,
          birthTime: nextUnknown ? '' : partner.birthTime,
          birthTimePrecision: nextUnknown ? 'unknown' : 'branch-range'
        }
      };
    });
  };

  const toggleUnknownBirthTime = () => {
    setFormData((prev) => ({
      ...prev,
      isUnknownTime: !prev.isUnknownTime,
      birthTime: !prev.isUnknownTime ? '' : prev.birthTime,
      birthTimePrecision: !prev.isUnknownTime ? 'unknown' : prev.birthTime ? prev.birthTimePrecision : 'branch-range'
    }));
  };

  const toggleLeapMonth = () => {
    setFormData((prev) => {
      if (isGeneralSignatureFlow) {
        const next = applyGeneralSignatureCalendarSelection(prev, birthDigits, 'lunar');
        return {
          ...next,
          isLeapMonth: prev.calendar === 'lunar' ? !prev.isLeapMonth : true
        };
      }

      if (prev.calendar !== 'lunar') {
        return { ...prev, calendar: 'lunar', isLeapMonth: true };
      }

      return { ...prev, isLeapMonth: !prev.isLeapMonth };
    });
  };

  const selfBirthValidation = useMemo(
    () => validateBirthInput(formData, { subjectLabel: '본인' }),
    [
      formData.name,
      formData.gender,
      formData.calendar,
      formData.isLeapMonth,
      formData.birthDate,
      formData.birthTime,
      formData.isUnknownTime,
      formData.birthTimePrecision,
      formData.dayBoundaryPolicy,
      formData.birthLocation,
      formData.location
    ]
  );
  const partnerBirthValidation = useMemo(
    () => validateBirthInput(partnerData, { subjectLabel: '상대방' }),
    [partnerData]
  );
  const birthDateReady = Boolean(formData.birthDate);
  const step1Ready = selfBirthValidation.valid;
  const isLoveReadingFlow = product.flow.intakeVariant === 'love-reading';
  const step2Ready = isPastLifeFlow
    ? Boolean(formData.pastLifeTopic?.trim())
    : isCompatibilityFlow
      ? partnerBirthValidation.valid
      : isGeneralSignatureFlow
        ? isGeneralSignatureRelationshipReady(formData)
      : isLoveReadingFlow
        ? Boolean(formData.relationshipStatus) &&
          (!isRelationshipDurationRequired(formData.relationshipStatus) || Boolean(formData.relationshipDuration))
        : Boolean(formData.relationshipStatus) && Boolean(formData.relationshipDuration);
  const step3Ready = isPastLifeFlow
    ? Boolean(formData.repeatedScene?.trim()) && Boolean(formData.frequentEmotion?.trim()) && Boolean(formData.hiddenDesire?.trim())
    : Boolean(formData.q1.trim());
  const step4Ready = isPastLifeFlow
    ? Boolean(formData.chosenSymbol?.trim()) && Boolean(formData.readingTone?.trim())
    : Boolean(formData.q2.trim());
  const canSubmit = step1Ready && step2Ready && step3Ready && step4Ready;
  const isYearlyFlow = false;
  const isCinematicFlow = true;
  const activeVisual = (isYearlyFlow ? yearlyStepVisuals : stepVisuals)[step];
  const activeQuestionSuggestions = isPastLifeFlow
    ? pastLifeQuestionSuggestions
    : isLoveReadingFlow
      ? loveReadingQuestionSuggestions
      : isGeneralSignatureFlow
        ? GENERAL_SIGNATURE_PRODUCT.intake.questionSuggestions
        : questionSuggestions;
  const generalBirthError = isGeneralSignatureFlow && birthDigits.length === 8
    ? selfBirthValidation.errors.find((error) =>
        ['birthDate', 'isLeapMonth', 'birthTime', 'birthTimePrecision', 'dayBoundaryPolicy'].includes(error.field)
      )
    : undefined;
  const pastLifeGuideCopy =
    step === 4 && formData.readingTone && pastLifeToneReplies[formData.readingTone]
      ? { eyebrow: pastLifeGuideStepCopy[step].eyebrow, line: pastLifeToneReplies[formData.readingTone] }
      : pastLifeGuideStepCopy[step];
  const intakeVideoSource = isPastLifeFlow ? PAST_LIFE_PRODUCT.film : '/signature-intake-hero.mp4';
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
      ? formData.birthTimePrecision === 'exact'
        ? `${formData.birthTime} 정확 시각으로 계산합니다.`
        : `${formData.birthTime} 시간대의 시작·중앙·종료점을 비교해 민감도를 반영합니다.`
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

    const submittedFormData = isPastLifeFlow
      ? {
          ...formData,
          q1: `전생사주에서 ${formData.pastLifeTopic} 주제와 연결된 반복 장면을 풀어주세요. 실제 반복 장면: ${formData.repeatedScene}`,
          q2: `자주 드는 감정은 ${formData.frequentEmotion}, 숨기기 어려운 욕심은 ${formData.hiddenDesire}입니다. ${formData.chosenSymbol} 상징을 선택했고 ${formData.readingTone} 말투로 현생 미션을 알려주세요.`
        }
      : formData;

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

    navigate('/checkout', {
      state: {
        product: service.id,
        formData: submittedFormData,
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
      } ${isLoveReadingFlow ? 'love-reading-video-flow-page' : ''} ${isPastLifeFlow ? 'past-life-goblin-flow-page' : ''} ${
        isGeneralSignatureFlow ? 'general-signature-flow-page' : ''
      }`}
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

        <section className="intake-story-copy" aria-hidden={isPastLifeFlow || isLoveReadingFlow ? undefined : true}>
          {isYearlyFlow ? (
            <article className="yearly-flow-scene-card">
              <span>{yearlySceneCopy[step].kicker}</span>
              <strong>{yearlySceneCopy[step].title}</strong>
              <p>{yearlySceneCopy[step].body}</p>
            </article>
          ) : null}

          <div
            className={
              isLoveReadingFlow
                ? 'intake-story-hero-art signature-intake-hero-art mz-love-intake-hero-art'
                : isCinematicFlow
                  ? 'intake-story-hero-art signature-intake-hero-art'
                  : 'intake-story-hero-art'
            }
            aria-hidden={isPastLifeFlow || isLoveReadingFlow ? undefined : true}
          >
            {isPastLifeFlow ? (
              <img
                src={PAST_LIFE_PRODUCT.intakeImage}
                alt="검은 장부를 들고 다음 질문을 건네는 도깨비 장부지기"
                className="intake-story-hero-image past-life-intake-hero-image"
              />
            ) : isLoveReadingFlow ? (
              <picture>
                <source
                  srcSet="/images/mz-love-fact/generated/hero-fan-closed.avif"
                  type="image/avif"
                />
                <img
                  src="/images/mz-love-fact/generated/hero-fan-closed.webp"
                  alt="접힌 검붉은 부채를 들고 다음 연애운 질문을 건네는 MZ무당"
                  className="intake-story-hero-image mz-love-intake-hero-image"
                />
              </picture>
            ) : isCinematicFlow ? (
              <video
                className="intake-story-hero-video"
                src={intakeVideoSource}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            ) : (
              <img src={activeVisual.background} alt="" className="intake-story-hero-image" />
            )}
            {isPastLifeFlow ? (
              <div className="past-life-intake-guide-dialogue" role="status" aria-live="polite">
                <img src={PAST_LIFE_PRODUCT.guideAvatar} alt="" />
                <div>
                  <small>도깨비 장부지기 · {pastLifeGuideCopy.eyebrow}</small>
                  <p>{pastLifeGuideCopy.line}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="intake-story-panel">
          {step === 1 ? (
            <div className="intake-story-form-stack">
              <label className="intake-story-field">
                <span>{isPastLifeFlow ? '장부에 표시할 이름 또는 호칭' : '나의 이름'}</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => updateField('name', event.target.value.slice(0, 12))}
                  placeholder={isPastLifeFlow ? '장부에 남길 이름을 입력해 주세요' : '이름을 입력해 주세요'}
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
                    onClick={() => selectBirthCalendar('solar')}
                  >
                    양력
                  </button>
                  <button
                    type="button"
                    className={formData.calendar === 'lunar' ? 'intake-story-pill active' : 'intake-story-pill'}
                    onClick={() => selectBirthCalendar('lunar')}
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
                <input
                  type="time"
                  value={getExactBirthTimeValue(formData)}
                  disabled={formData.isUnknownTime}
                  onChange={(event) => updateExactBirthTime(event.target.value)}
                  aria-label="정확한 출생 시각"
                />
                <p className="intake-story-caption">
                  정확한 시각을 알면 시·분을 먼저 입력하세요. 모르면 아래 시간대만 선택할 수 있습니다.
                </p>
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
                <span>출생 지역</span>
                <div className="intake-story-select-wrap">
                  <select
                    value={formData.birthLocation?.label || birthLocationOptions[0].label}
                    onChange={(event) => updateBirthLocation(event.target.value)}
                  >
                    {birthLocationOptions.map((option) => (
                      <option key={option.label} value={option.label}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
                <p className="intake-story-caption">
                  선택한 지역은 진태양시 보정 근거로만 사용하며, 모르면 기존 한국 표준시로 계산합니다.
                </p>
              </div>

              <div className="intake-story-field">
                <span>23시대 날짜 경계 기준</span>
                <div className="intake-story-segment-grid">
                  <button
                    type="button"
                    className={formData.dayBoundaryPolicy !== 'late-zi' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                    onClick={() => updateField('dayBoundaryPolicy', 'midnight')}
                  >
                    자정 기준
                  </button>
                  <button
                    type="button"
                    className={formData.dayBoundaryPolicy === 'late-zi' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                    onClick={() => updateField('dayBoundaryPolicy', 'late-zi')}
                  >
                    야자시 익일 기준
                  </button>
                </div>
                <p className="intake-story-caption">
                  23시 이후 일주를 다음 날로 보는 학파 기준입니다. 출생 기록 기준을 모르면 자정 기준을 유지하세요.
                </p>
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

              {isGeneralSignatureFlow ? <GeneralSignaturePolicyNotice formData={formData} /> : null}
              {generalBirthError ? (
                <p className="general-signature-input-error" role="alert">{generalBirthError.message}</p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            isPastLifeFlow ? (
              <div className="intake-story-form-stack past-life-intake-stack">
                <div className="intake-story-question-copy">
                  <span className="past-life-intake-volume">두 번째 봉인</span>
                  <strong>지금 가장 마음에 걸리는 걸 하나만 골라</strong>
                  <p>그 질문을 중심으로 전생의 장면과 지금 반복되는 선택을 한 줄로 이어볼게.</p>
                </div>

                <article className="intake-story-question-card past-life-intake-card">
                  <div className="intake-story-question-head">
                    <strong>현재 가장 궁금한 주제</strong>
                    <span className="intake-story-order-badge">02</span>
                  </div>
                  <div className="past-life-choice-grid topic-grid">
                    {pastLifeTopicOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={formData.pastLifeTopic === option ? 'past-life-choice active' : 'past-life-choice'}
                        aria-pressed={formData.pastLifeTopic === option}
                        onClick={() => updateField('pastLifeTopic', option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </article>
              </div>
            ) : isCompatibilityFlow ? (
              <div className="intake-story-form-stack">
                <div className="intake-story-question-copy">
                  <strong>상대방의 출생 정보를 입력해 주세요</strong>
                  <p>정밀 궁합은 두 사람의 원국을 각각 계산한 뒤 배우자궁·오행·합충과 현재 운을 함께 비교합니다.</p>
                </div>

                <label className="intake-story-field">
                  <span>상대방 이름 또는 호칭</span>
                  <input
                    type="text"
                    value={partnerData.name}
                    onChange={(event) => updatePartnerField('name', event.target.value.slice(0, 12))}
                    placeholder="상대방을 구분할 이름"
                  />
                </label>

                <div className="intake-story-field">
                  <span>상대방 성별</span>
                  <div className="intake-story-segment-grid">
                    <button
                      type="button"
                      className={partnerData.gender === 'male' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                      onClick={() => updatePartnerField('gender', 'male')}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      className={partnerData.gender === 'female' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                      onClick={() => updatePartnerField('gender', 'female')}
                    >
                      여성
                    </button>
                  </div>
                </div>

                <div className="intake-story-field">
                  <div className="intake-story-field-head">
                    <span>상대방 생년월일</span>
                    <button
                      type="button"
                      className="intake-story-mini-check"
                      aria-pressed={partnerData.calendar === 'lunar' && partnerData.isLeapMonth}
                      onClick={() => {
                        updatePartnerField('calendar', 'lunar');
                        updatePartnerField('isLeapMonth', !partnerData.isLeapMonth);
                      }}
                    >
                      <span className={partnerData.isLeapMonth ? 'intake-story-mini-box checked' : 'intake-story-mini-box'}>
                        <Check size={11} />
                      </span>
                      <small>윤달</small>
                    </button>
                  </div>
                  <div className="intake-story-pill-row">
                    <button
                      type="button"
                      className={partnerData.calendar === 'solar' ? 'intake-story-pill active' : 'intake-story-pill'}
                      onClick={() => {
                        updatePartnerField('calendar', 'solar');
                        updatePartnerField('isLeapMonth', false);
                      }}
                    >
                      양력
                    </button>
                    <button
                      type="button"
                      className={partnerData.calendar === 'lunar' ? 'intake-story-pill active' : 'intake-story-pill'}
                      onClick={() => updatePartnerField('calendar', 'lunar')}
                    >
                      음력
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={partnerBirthDigits}
                    onChange={(event) => updatePartnerBirthDate(event.target.value)}
                    placeholder="19901231"
                  />
                </div>

                <div className="intake-story-field">
                  <div className="intake-story-field-head">
                    <span>상대방 출생 시각</span>
                    <button
                      type="button"
                      className="intake-story-mini-check"
                      aria-pressed={partnerData.isUnknownTime}
                      onClick={togglePartnerUnknownBirthTime}
                    >
                      <span className={partnerData.isUnknownTime ? 'intake-story-mini-box checked' : 'intake-story-mini-box'}>
                        <Check size={11} />
                      </span>
                      <small>시간 모름</small>
                    </button>
                  </div>
                  <input
                    type="time"
                    value={getPartnerExactBirthTimeValue(partnerData)}
                    disabled={partnerData.isUnknownTime}
                    onChange={(event) => updatePartnerExactBirthTime(event.target.value)}
                    aria-label="상대방의 정확한 출생 시각"
                  />
                  <div className="intake-story-select-wrap">
                    <select
                      value={getPartnerBirthTimeSelectValue(partnerData)}
                      disabled={partnerData.isUnknownTime}
                      onChange={(event) => updatePartnerBirthTime(event.target.value)}
                    >
                      <option value="">정확한 시간을 모르면 시간대 선택</option>
                      {birthTimeOptions.filter((option) => option.value !== 'unknown').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </div>

                <div className="intake-story-field">
                  <span>상대방 출생 지역</span>
                  <div className="intake-story-select-wrap">
                    <select
                      value={partnerData.birthLocation?.label || birthLocationOptions[0].label}
                      onChange={(event) => updatePartnerBirthLocation(event.target.value)}
                    >
                      {birthLocationOptions.map((option) => (
                        <option key={option.label} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                  <p className="intake-story-caption">
                    선택 지역은 한국 표준시(UTC+9)와 경도 기반 진태양시 보정에 사용합니다.
                  </p>
                </div>

                <div className="intake-story-field">
                  <span>23시대 날짜 경계 기준</span>
                  <div className="intake-story-segment-grid">
                    <button
                      type="button"
                      className={partnerData.dayBoundaryPolicy !== 'late-zi' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                      onClick={() => updatePartnerField('dayBoundaryPolicy', 'midnight')}
                    >
                      자정 기준
                    </button>
                    <button
                      type="button"
                      className={partnerData.dayBoundaryPolicy === 'late-zi' ? 'intake-story-segment-button active' : 'intake-story-segment-button'}
                      onClick={() => updatePartnerField('dayBoundaryPolicy', 'late-zi')}
                    >
                      야자시 익일 기준
                    </button>
                  </div>
                  <p className="intake-story-caption">
                    출생 기록의 기준을 모르면 자정 기준을 유지하세요. 두 기준 차이는 리포트의 불확실성에 표시됩니다.
                  </p>
                </div>
              </div>
            ) : (
            <div className="intake-story-form-stack">
              <div className="intake-story-question-copy">
                <strong>
                  {isGeneralSignatureFlow
                    ? GENERAL_SIGNATURE_PRODUCT.intake.relationshipCopy.title
                    : '현재 관계 상태를 알려주세요'}
                </strong>
                <p>
                  {isGeneralSignatureFlow
                    ? GENERAL_SIGNATURE_PRODUCT.intake.relationshipCopy.body
                    : '솔로, 썸, 연애, 애매한 관계, 이별·재회, 기혼 중 지금과 가장 가까운 상태를 골라주세요.'}
                </p>
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
                      onClick={() => selectRelationshipStatus(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.body}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>
                    기간은 얼마나 되나요?
                    {(isLoveReadingFlow || isGeneralSignatureFlow) &&
                    !isRelationshipDurationRequired(formData.relationshipStatus) ? ' (선택)' : ''}
                  </strong>
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
                  {isGeneralSignatureFlow
                    ? GENERAL_SIGNATURE_PRODUCT.intake.relationshipCopy.durationCaption
                    : '연애 중·기혼은 현재 관계가 이어진 기간을 골라주세요. 썸·애매한 관계·이별·재회는 기억나는 범위에서 선택해도 됩니다.'}
                </p>
              </article>
            </div>
            )
          ) : null}

          {step === 3 ? (
            isPastLifeFlow ? (
              <div className="intake-story-form-stack past-life-intake-stack">
                <div className="intake-story-question-copy">
                  <span className="past-life-intake-volume">세 번째 봉인</span>
                  <strong>이번엔 꾸미지 말고, 반복되는 장면을 들려줘</strong>
                  <p>또 시작됐다고 느끼는 순간과 그때의 감정, 사실 바라는 결말을 적을수록 장부가 선명하게 열려.</p>
                </div>

                <article className="intake-story-question-card past-life-intake-card past-life-text-card">
                  <label>
                    <span>이상하게 반복되는 장면 한 가지</span>
                    <textarea
                      value={formData.repeatedScene || ''}
                      onChange={(event) => updateField('repeatedScene', event.target.value.slice(0, 180))}
                      placeholder="예: 결국 제가 뒷수습을 맡고, 참다가 갑자기 관계를 끊어요."
                    />
                  </label>
                  <label>
                    <span>요즘 가장 자주 드는 감정</span>
                    <textarea
                      value={formData.frequentEmotion || ''}
                      onChange={(event) => updateField('frequentEmotion', event.target.value.slice(0, 100))}
                      placeholder="예: 억울함, 피로, 불안, 설명하기 싫은 마음"
                    />
                  </label>
                  <label>
                    <span>남들에게 말하기 어려운 욕심</span>
                    <textarea
                      value={formData.hiddenDesire || ''}
                      onChange={(event) => updateField('hiddenDesire', event.target.value.slice(0, 120))}
                      placeholder="예: 인정받고 싶지만 책임은 더 늘리고 싶지 않아요."
                    />
                  </label>
                </article>
              </div>
            ) : (
            <div className="intake-story-form-stack">
              <div className="intake-story-question-copy">
                <strong>
                  {isGeneralSignatureFlow
                    ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q1.title
                    : '첫 번째 질문을 적어주세요'}
                </strong>
                <p>
                  {isLoveReadingFlow
                    ? '지금 가장 마음을 흔드는 관계나 반복 패턴을 적으면 첫 번째 맞춤 연애 분석으로 이어집니다.'
                    : isGeneralSignatureFlow
                      ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q1.body
                      : '가장 시급하거나 가장 궁금한 고민을 먼저 적으면 결과 리포트에서 첫 번째 맞춤 답변 카드로 분석됩니다.'}
                </p>
              </div>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>질문 1</strong>
                  <span className="intake-story-order-badge">Q1</span>
                </div>
                <textarea
                  value={formData.q1}
                  onChange={(event) => updateField('q1', event.target.value.slice(0, 180))}
                  placeholder={isLoveReadingFlow
                    ? '예: 지금 반복되는 애매한 관계를 계속 이어가도 될까요?'
                    : isGeneralSignatureFlow
                      ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q1.placeholder
                      : '예: 지금 제 인생에서 가장 먼저 정리해야 할 흐름은 무엇인가요?'}
                />
                <div className="intake-story-question-meta">
                  <span>
                    {isLoveReadingFlow
                      ? '상대의 속마음을 추측하기보다 실제 상황과 궁금한 선택을 적어주세요.'
                      : isGeneralSignatureFlow
                        ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q1.helper
                        : '구체적인 질문일수록 결과 문장이 더 선명해집니다.'}
                  </span>
                  <span>{formData.q1.length}/180</span>
                </div>
                <div className="intake-story-suggestion-row">
                  {activeQuestionSuggestions.q1.map((item) => (
                    <button key={item} type="button" className="intake-story-suggestion" onClick={() => applyQuestionSuggestion('q1', item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </article>
            </div>
            )
          ) : null}

          {step === 4 ? (
            isPastLifeFlow ? (
              <div className="intake-story-form-stack past-life-intake-stack">
                <div className="intake-story-question-copy">
                  <span className="past-life-intake-volume">마지막 봉인</span>
                  <strong>끌리는 상징과 내가 말할 온도를 골라줘</strong>
                  <p>상징은 이야기를 여는 장치일 뿐 사주 계산값은 바꾸지 않아. 말투만 네가 편하게 들을 수 있게 맞출게.</p>
                </div>

                <article className="intake-story-question-card past-life-intake-card">
                  <div className="intake-story-question-head">
                    <strong>지금 가장 끌리는 상징</strong>
                    <span className="intake-story-order-badge">象</span>
                  </div>
                  <div className="past-life-choice-grid symbol-grid">
                    {pastLifeSymbolOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={formData.chosenSymbol === option ? 'past-life-choice active' : 'past-life-choice'}
                        aria-pressed={formData.chosenSymbol === option}
                        onClick={() => updateField('chosenSymbol', option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </article>

                <article className="intake-story-question-card past-life-intake-card">
                  <div className="intake-story-question-head">
                    <strong>도깨비의 말투</strong>
                    <span className="intake-story-order-badge">語</span>
                  </div>
                  <div className="past-life-choice-grid tone-grid">
                    {pastLifeToneOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={formData.readingTone === option ? 'past-life-choice active' : 'past-life-choice'}
                        aria-pressed={formData.readingTone === option}
                        onClick={() => updateField('readingTone', option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </article>
              </div>
            ) : (
            <div className="intake-story-form-stack">
              <div className="intake-story-question-copy">
                <strong>
                  {isGeneralSignatureFlow
                    ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q2.title
                    : '두 번째 질문도 적어주세요'}
                </strong>
                <p>
                  {isLoveReadingFlow
                    ? '결제 후 두 질문을 각각 분석하고, 계산된 명리 근거와 현실에서 확인할 행동을 함께 제공합니다.'
                    : isGeneralSignatureFlow
                      ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q2.body
                      : '결제 후 결과 페이지에서는 질문 2개가 각각 따로 분석되며, 결정론 명리 근거와 AI 해설이 함께 제공됩니다.'}
                </p>
              </div>

              <article className="intake-story-question-card">
                <div className="intake-story-question-head">
                  <strong>질문 2</strong>
                  <span className="intake-story-order-badge">Q2</span>
                </div>
                <textarea
                  value={formData.q2}
                  onChange={(event) => updateField('q2', event.target.value.slice(0, 180))}
                  placeholder={isLoveReadingFlow
                    ? '예: 앞으로 12개월 중 새 인연을 만나기 좋은 흐름은 언제인가요?'
                    : isGeneralSignatureFlow
                      ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q2.placeholder
                      : '예: 앞으로 3개월 안에 움직이면 좋은 시기는 언제인가요?'}
                />
                <div className="intake-story-question-meta">
                  <span>
                    {isLoveReadingFlow
                      ? '첫 질문과 다른 방향—시기·상대 기준·연락 행동—이면 리포트 폭이 더 넓어집니다.'
                      : isGeneralSignatureFlow
                        ? GENERAL_SIGNATURE_PRODUCT.intake.questions.q2.helper
                        : '질문 1과 다른 방향의 질문이면 리포트 폭이 더 넓어집니다.'}
                  </span>
                  <span>{formData.q2.length}/180</span>
                </div>
                <div className="intake-story-suggestion-row">
                  {activeQuestionSuggestions.q2.map((item) => (
                    <button key={item} type="button" className="intake-story-suggestion" onClick={() => applyQuestionSuggestion('q2', item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </article>
            </div>
            )
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
              {step === 4
                ? isPastLifeFlow
                  ? '49,000원 · 내 전생장부 열기'
                  : isYearlyFlow
                    ? '결제하고 신년운세 보기'
                    : isGeneralSignatureFlow
                      ? '결제 전 구성 확인'
                      : '결제 정보 확인'
                : '다음으로'}
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
