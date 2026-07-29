import { ArrowLeft, Check, Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IntakeFormData, PartnerBirthData } from '../api/mockData';
import {
  finalizeReunionIntake,
  hydrateReunionIntake,
  readReunionDraft,
  saveReunionDraft,
  validateReunionStep
} from '../lib/reunion/intake';
import {
  reunionBreakupReasonValues,
  reunionQuestionValues,
  type ReunionBreakupReason,
  type ReunionContext,
  type ReunionIntakeData,
  type ReunionQuestionId,
  type ReunionRelationshipFacts,
  type ReunionSafetySignals
} from '../lib/reunion/types';
import '../styles/reunion-micro-intake.css';

type LocationState = { formData?: Partial<ReunionIntakeData>; tabOrigin?: string };
type BirthPeriod = '' | 'am' | 'pm';
type ObstacleKey = 'familyObstacle' | 'workObstacle' | 'moneyObstacle' | 'trustObstacle' | 'valuesObstacle' | 'marriageObstacle' | 'childrenObstacle';
type ReadinessKey = Exclude<keyof ReunionContext['readiness'], 'level'>;
type StepId =
  | 'self-date' | 'self-time' | 'self-gender' | 'self-name' | 'self-accuracy' | 'consent'
  | 'partner-known' | 'partner-date' | 'partner-time' | 'partner-gender' | 'partner-name' | 'partner-accuracy'
  | 'relationship-start' | 'breakup-date' | 'breakup-initiator' | 'breakup-reasons' | 'breakup-detail'
  | 'past-reunions' | 'repeated-cause' | 'last-contact-date' | 'last-contact-mood' | 'contact-frequency'
  | 'block-state' | 'new-relationship' | 'distance' | 'obstacles' | 'safety' | 'readiness-check'
  | 'readiness-level' | 'desired-outcome' | 'feared-outcome' | 'questions' | 'custom-question'
  | 'message-draft' | 'attempted-contact';

const BACKGROUND_VIDEO = '/media/mz-love-intake-background.mp4';
const BACKGROUND_POSTER = '/images/mz-love-fact/generated/room-corridor.webp';
const BEFORE_PARTNER: StepId[] = ['self-date', 'self-time', 'self-gender', 'self-name', 'self-accuracy', 'consent', 'partner-known'];
const PARTNER: StepId[] = ['partner-date', 'partner-time', 'partner-gender', 'partner-name', 'partner-accuracy'];
const AFTER_PARTNER: StepId[] = [
  'relationship-start', 'breakup-date', 'breakup-initiator', 'breakup-reasons', 'breakup-detail',
  'past-reunions', 'repeated-cause', 'last-contact-date', 'last-contact-mood', 'contact-frequency',
  'block-state', 'new-relationship', 'distance', 'obstacles', 'safety', 'readiness-check',
  'readiness-level', 'desired-outcome', 'feared-outcome', 'questions', 'custom-question',
  'message-draft', 'attempted-contact'
];

const COPY: Record<StepId, [string, string]> = {
  'self-date': ['먼저, 생년월일을 알려줘', '네 원국과 재회 흐름을 계산하는 첫 번째 단서야.'],
  'self-time': ['태어난 시간은?', '오전·오후와 시·분을 나눠 입력해 줘. 모르면 가능한 시주를 비교할게.'],
  'self-gender': ['성별은?', '대운의 방향과 관계 흐름을 계산할 때 반영할게.'],
  'self-name': ['내가 뭐라고 부르면 돼?', '이름이나 리포트에서 사용할 호칭을 적어줘.'],
  'self-accuracy': ['이 출생 정보는 얼마나 정확해?', '기억의 정확도까지 결과의 신뢰도에 따로 표시할게.'],
  consent: ['시작 전에 꼭 확인할게', '성인 확인과 민감정보 사용, 입력 권한을 한 번에 명확히 동의해 줘.'],
  'partner-known': ['그 사람의 생년월일을 알아?', '모르면 억지로 궁합을 만들지 않고 네 원국과 관계 사실만 볼게.'],
  'partner-date': ['그 사람의 생년월일은?', '알고 있는 달력 기준도 함께 선택해 줘.'],
  'partner-time': ['그 사람의 태어난 시간은?', '정확히 모르면 시간 모름을 선택해도 괜찮아.'],
  'partner-gender': ['그 사람의 성별은?', '두 사람 원국을 같은 기준으로 계산할게.'],
  'partner-name': ['그 사람을 뭐라고 부를까?', '실명 대신 알아볼 수 있는 호칭을 적어도 돼.'],
  'partner-accuracy': ['그 사람의 정보는 얼마나 정확해?', '전해 들은 정보라면 결론의 강도를 낮춰 표시할게.'],
  'relationship-start': ['두 사람은 언제 시작됐어?', '정확한 날짜를 모르면 건너뛰어도 돼.'],
  'breakup-date': ['헤어진 날짜는 언제야?', '재회 흐름과 연락 간격을 계산하려면 꼭 필요한 날짜야.'],
  'breakup-initiator': ['누가 먼저 이별을 말했어?', '확인된 상황에 가장 가까운 걸 골라줘.'],
  'breakup-reasons': ['왜 헤어졌다고 생각해?', '확인된 이유를 모두 골라줘. 최소 한 가지가 필요해.'],
  'breakup-detail': ['그때 실제로 무슨 일이 있었어?', '속마음 추측보다 확인된 말과 행동을 짧게 적어줘.'],
  'past-reunions': ['이 사람과 다시 만난 적은 몇 번이야?', '반복 횟수는 같은 원인이 되살아날 위험을 보는 단서야.'],
  'repeated-cause': ['같은 이유로 멀어진 적이 있어?', '이번 이별만의 문제인지 반복 구조인지 분리해서 볼게.'],
  'last-contact-date': ['마지막으로 연락한 날은?', '정확한 날짜를 모르면 모름을 선택해도 돼.'],
  'last-contact-mood': ['마지막 연락 분위기는 어땠어?', '실제 대화의 온도에 가장 가까운 걸 골라줘.'],
  'contact-frequency': ['지금은 얼마나 연락해?', '현재 확인되는 연락 빈도를 기준으로 볼게.'],
  'block-state': ['현재 차단 상태는?', '차단과 명시적 거절은 어떤 좋은 운보다 먼저 적용돼.'],
  'new-relationship': ['확인된 새 관계가 있어?', '소문이나 추측 말고 실제로 확인한 범위만 골라줘.'],
  distance: ['지금 두 사람의 거리는?', '연락 이후 실제 만남이 가능한 조건인지 함께 볼게.'],
  obstacles: ['아직 남아 있는 현실 장벽은?', '해당되는 걸 모두 고르고, 없다면 그대로 확인해 줘.'],
  safety: ['안전 때문에 멈춰야 할 신호가 있어?', '이 답은 명리보다 먼저 연락 시기와 문장을 제한할 수 있어.'],
  'readiness-check': ['다시 연락할 준비는 어디까지 됐어?', '바라는 마음보다 실제로 할 수 있는 행동을 확인해 줘.'],
  'readiness-level': ['지금 감정은 얼마나 안정돼 있어?', '어떤 답을 받아도 경계를 지킬 수 있는지를 기준으로 골라줘.'],
  'desired-outcome': ['네가 원하는 결말은 뭐야?', '재회와 대화, 사과와 정리는 서로 다른 전략이 필요해.'],
  'feared-outcome': ['가장 두려운 결말은?', '짧게 적어도 되고, 지금 말하기 어렵다면 비워둬도 괜찮아.'],
  questions: ['가장 궁금한 걸 골라줘', '3개에서 5개까지 선택하면 미리보기부터 이 순서로 답할게.'],
  'custom-question': ['딱 하나 더 묻고 싶은 건?', '선택지에 없던 질문이 있다면 여기에 적어줘.'],
  'message-draft': ['보내려던 메시지가 있어?', '아직 보내지 않은 문장의 압박과 경계 우회 표현을 점검할게.'],
  'attempted-contact': ['이미 시도한 연락을 마지막으로 알려줘', '언제, 몇 번, 어떤 채널로 연락했는지 적으면 준비가 끝나.']
};

const DEFAULT_PARTNER: PartnerBirthData = {
  name: '', gender: 'male', calendar: 'solar', isLeapMonth: false, birthDate: '', birthTime: '',
  isUnknownTime: false, birthTimePrecision: 'exact', dayBoundaryPolicy: 'midnight'
};
const BREAKUP_LABELS: Record<ReunionBreakupReason, string> = {
  communication: '대화 단절', trust: '신뢰 문제', distance: '장거리', family: '가족 반대',
  work: '일·시간', money: '돈 문제', values: '가치관', marriage: '결혼관', children: '자녀관',
  infidelity: '외도', 'emotional-exhaustion': '감정 소진', unclear: '이유가 불분명'
};
const QUESTION_LABELS: Record<ReunionQuestionId, string> = {
  'contact-temperature': '그 사람의 현재 연락 온도', 'contact-timing': '연락을 검토할 시기',
  'contact-first': '내가 먼저 연락해도 되는지', 'reply-strategy': '답장 흐름과 대응',
  'meeting-strategy': '다시 만나는 단계', 'reunion-index': '우리의 재회 지수',
  'recurrence-risk': '같은 이유 재발 위험', 'long-term-fit': '재회 후 장기 지속'
};
const SAFETY: ReadonlyArray<{ key: keyof ReunionSafetySignals; label: string }> = [
  { key: 'explicitNoContact', label: '상대가 연락하지 말라고 명시했어요' },
  { key: 'stalkingOrReport', label: '스토킹 신고·접근 제한·경찰 개입이 있었어요' },
  { key: 'violence', label: '신체적 폭력이 있었어요' }, { key: 'threats', label: '위협·협박이 있었어요' },
  { key: 'coerciveControl', label: '감시·고립·강압적 통제가 있었어요' },
  { key: 'financialExploitation', label: '금전 착취·반복 송금 요구가 있었어요' },
  { key: 'selfHarmPressure', label: '자해를 조건으로 관계를 요구했어요' },
  { key: 'blockCircumventionAttempt', label: '차단을 다른 번호·계정으로 우회하려 했어요' },
  { key: 'disruptingNewRelationship', label: '상대의 새 관계를 방해하는 접촉을 고민 중이에요' }
];
const READINESS: ReadonlyArray<{ key: ReadinessKey; label: string }> = [
  { key: 'accountabilityTaken', label: '내가 책임질 부분을 구체적으로 말할 수 있어요' },
  { key: 'breakupCauseChanged', label: '이별 원인을 바꾼 행동이 이미 시작됐어요' },
  { key: 'canAcceptNoReply', label: '답이 없어도 추가 연락하지 않을 수 있어요' },
  { key: 'canRespectBoundary', label: '거절·차단을 우회하지 않을 수 있어요' },
  { key: 'supportAvailable', label: '흔들릴 때 도움을 청할 사람이 있어요' }
];
const OBSTACLES: ReadonlyArray<{ key: ObstacleKey; label: string }> = [
  { key: 'familyObstacle', label: '가족' }, { key: 'workObstacle', label: '일·시간' },
  { key: 'moneyObstacle', label: '돈' }, { key: 'trustObstacle', label: '신뢰' },
  { key: 'valuesObstacle', label: '가치관' }, { key: 'marriageObstacle', label: '결혼관' },
  { key: 'childrenObstacle', label: '자녀관' }
];

type Option = { value: string; label: string; detail?: string };
function Choices({ value, options, onSelect }: { value: string; options: ReadonlyArray<Option>; onSelect: (value: string) => void }) {
  return <div className="reunion-micro-choice-stack">{options.map((option) => { const selected = value === option.value; return <button key={option.value} type="button" className={selected ? 'is-selected' : undefined} aria-pressed={selected} onClick={() => onSelect(option.value)}><span><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span><i>{selected ? <Check size={17} /> : null}</i></button>; })}</div>;
}
function Complete({ label, onClick, disabled = false, final = false }: { label: string; onClick: () => void; disabled?: boolean; final?: boolean }) {
  return <button type="button" className={final ? 'reunion-micro-complete is-final' : 'reunion-micro-complete'} onClick={onClick} disabled={disabled}>{final ? <Sparkles size={18} /> : <Check size={17} />}<strong>{label}</strong></button>;
}

const dateDigits = (value: string) => value.replace(/\D/g, '').slice(0, 8);
function displayDate(value: string) { const digits = dateDigits(value); if (digits.length <= 4) return digits; if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`; return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`; }
function normalizeDate(value: string) { const digits = dateDigits(value); return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : ''; }
function validDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(value + 'T12:00:00'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function validBirthDate(value: string, calendar: IntakeFormData['calendar']) { const normalized = normalizeDate(value); if (!normalized) return false; if (calendar === 'solar') return validDate(normalized); const [, month, day] = normalized.split('-').map(Number); return month >= 1 && month <= 12 && day >= 1 && day <= 30; }

function BirthDate({ value, calendar, leap, onCalendar, onLeap, onDone }: { value: string; calendar: IntakeFormData['calendar']; leap: boolean; onCalendar: (value: IntakeFormData['calendar']) => void; onLeap: (value: boolean) => void; onDone: (value: string) => void }) {
  const [digits, setDigits] = useState(() => dateDigits(value)); const [error, setError] = useState('');
  useEffect(() => setDigits(dateDigits(value)), [value]);
  const finish = (next: string, nextCalendar = calendar) => { if (next.length !== 8) return; if (!validBirthDate(next, nextCalendar)) { setError('실제 날짜 8자리인지 다시 확인해 줘.'); return; } setError(''); onDone(normalizeDate(next)); };
  return <div className="reunion-micro-field-stack"><div className="reunion-micro-pills" role="group" aria-label="양력 또는 음력 선택">{(['solar', 'lunar'] as const).map((item) => <button key={item} type="button" className={calendar === item ? 'is-selected' : undefined} onClick={() => { onCalendar(item); finish(digits, item); }}>{item === 'solar' ? '양력' : '음력'}</button>)}{calendar === 'lunar' ? <button type="button" className={leap ? 'is-selected is-subtle' : 'is-subtle'} onClick={() => onLeap(!leap)}>윤달</button> : null}</div><label className="reunion-micro-line-field"><span className="sr-only">생년월일 8자리</span><input autoFocus type="text" inputMode="numeric" autoComplete="bday" maxLength={10} value={displayDate(digits)} placeholder="2000.01.01" onChange={(event) => { const next = dateDigits(event.target.value); setDigits(next); finish(next); }} /></label>{error ? <p className="reunion-micro-inline-error" role="alert">{error}</p> : null}</div>;
}

function parseTime(value: string): { period: BirthPeriod; hour: string; minute: string } { if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return { period: '', hour: '', minute: '' }; const [hour24, minute] = value.split(':'); const numeric = Number(hour24); return { period: numeric >= 12 ? 'pm' : 'am', hour: String(numeric % 12 || 12), minute }; }
function makeTime(period: BirthPeriod, hourText: string, minuteText: string) { if (!period || !hourText || !minuteText) return ''; const hour = Number(hourText); const minute = Number(minuteText); if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) return ''; const hour24 = (hour % 12) + (period === 'pm' ? 12 : 0); return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }
function BirthTime({ value, onDone, onUnknown }: { value: string; onDone: (value: string) => void; onUnknown: () => void }) {
  const initial = useMemo(() => parseTime(value), [value]); const [period, setPeriod] = useState<BirthPeriod>(initial.period); const [hour, setHour] = useState(initial.hour); const [minute, setMinute] = useState(initial.minute); const hourRef = useRef<HTMLInputElement>(null); const minuteRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setPeriod(initial.period); setHour(initial.hour); setMinute(initial.minute); }, [initial]);
  const finish = (p: BirthPeriod, h: string, m: string) => { const result = makeTime(p, h, m); if (result) onDone(result); return result; };
  return <div className="reunion-micro-field-stack"><div className="reunion-micro-time-period" role="group" aria-label="오전 또는 오후 선택">{([['am', '오전'], ['pm', '오후']] as const).map(([next, label]) => <button key={next} type="button" className={period === next ? 'is-selected' : undefined} onClick={() => { setPeriod(next); if (!finish(next, hour, minute)) window.requestAnimationFrame(() => hourRef.current?.focus()); }}>{label}</button>)}</div><div className="reunion-micro-time-fields"><label><span className="sr-only">태어난 시</span><input ref={hourRef} autoFocus={!period} type="text" inputMode="numeric" maxLength={2} value={hour} placeholder="12" onChange={(event) => { const next = event.target.value.replace(/\D/g, '').slice(0, 2); setHour(next); const number = Number(next); if (next.length === 2 && number >= 1 && number <= 12 && !finish(period, next, minute)) window.requestAnimationFrame(() => minuteRef.current?.focus()); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); minuteRef.current?.focus(); } }} /><b>시</b></label><i aria-hidden="true">:</i><label><span className="sr-only">태어난 분</span><input ref={minuteRef} type="text" inputMode="numeric" maxLength={2} value={minute} placeholder="30" onChange={(event) => { const next = event.target.value.replace(/\D/g, '').slice(0, 2); setMinute(next); if (next.length === 2) finish(period, hour, next); }} onBlur={() => { if (minute) { const next = minute.padStart(2, '0'); setMinute(next); finish(period, hour, next); } }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); const next = minute.padStart(2, '0'); setMinute(next); finish(period, hour, next); } }} /><b>분</b></label></div><button type="button" className="reunion-micro-unknown" onClick={onUnknown}><Clock3 size={18} />태어난 시간을 몰라요</button><p className="reunion-micro-note">시간을 모르면 가능한 시주를 비교해 공통 결론만 사용합니다.</p></div>;
}
function DateOnly({ value, onDone, unknown }: { value: string; onDone: (value: string) => void; unknown?: string }) { return <div className="reunion-micro-field-stack"><label className="reunion-micro-date-field"><span className="sr-only">날짜 선택</span><input autoFocus type="date" value={value} onChange={(event) => { if (validDate(event.target.value)) onDone(event.target.value); }} /></label>{unknown ? <button type="button" className="reunion-micro-skip" onClick={() => onDone('')}>{unknown}</button> : null}</div>; }
function LongText({ value, onChange, placeholder, max, rows = 4, children }: { value: string; onChange: (value: string) => void; placeholder: string; max: number; rows?: number; children?: ReactNode }) { return <div className="reunion-micro-text-card"><textarea autoFocus rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /><small>{value.length} / {max}</small>{children}</div>; }
function validationTarget(step: number, input: ReunionIntakeData): StepId { if (step === 1) { if (!validDate(input.birthDate)) return 'self-date'; if (!input.isUnknownTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) return 'self-time'; if (!input.name.trim()) return 'self-name'; return 'consent'; } if (step === 2) { if (!validDate(input.partner?.birthDate || '')) return 'partner-date'; if (!input.partner?.isUnknownTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.partner?.birthTime || '')) return 'partner-time'; return 'partner-name'; } if (step === 3) return validDate(input.reunion.facts.breakupDate) ? 'breakup-reasons' : 'breakup-date'; if (step === 4) { if (input.reunion.facts.lastContactMood === 'unknown') return 'last-contact-mood'; if (input.reunion.facts.blockState === 'unknown') return 'block-state'; return 'new-relationship'; } if (step === 6) return 'readiness-check'; return 'questions'; }

export default function ReunionIntake() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as LocationState | null) || null;
  const [draft, setDraft] = useState<ReunionIntakeData>(() => hydrateReunionIntake(state?.formData || readReunionDraft()));
  const [stepId, setStepId] = useState<StepId>('self-date');
  const [errors, setErrors] = useState<string[]>([]);
  const [videoFailed, setVideoFailed] = useState(false);
  const tabOrigin = state?.tabOrigin || '/detail/love-reunion';
  const partner = draft.partner || DEFAULT_PARTNER;
  const steps = useMemo(() => draft.reunion.partnerBirthKnown ? [...BEFORE_PARTNER, ...PARTNER, ...AFTER_PARTNER] : [...BEFORE_PARTNER, ...AFTER_PARTNER], [draft.reunion.partnerBirthKnown]);
  const currentIndex = Math.max(0, steps.indexOf(stepId));
  const progress = ((currentIndex + 1) / steps.length) * 100;

  useEffect(() => { saveReunionDraft(draft); }, [draft]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); setErrors([]); }, [stepId]);
  useEffect(() => { if (!steps.includes(stepId)) setStepId('partner-known'); }, [stepId, steps]);

  const patch = (next: Partial<ReunionIntakeData>) => setDraft((current) => ({ ...current, ...next }));
  const patchPartner = (next: Partial<PartnerBirthData>) => setDraft((current) => ({ ...current, partner: { ...(current.partner || DEFAULT_PARTNER), ...next } }));
  const patchReunion = (next: Partial<ReunionContext>) => setDraft((current) => ({ ...current, reunion: { ...current.reunion, ...next } }));
  const patchFacts = (next: Partial<ReunionRelationshipFacts>) => setDraft((current) => ({ ...current, reunion: { ...current.reunion, facts: { ...current.reunion.facts, ...next } } }));
  const patchSafety = (next: Partial<ReunionSafetySignals>) => setDraft((current) => ({ ...current, reunion: { ...current.reunion, safety: { ...current.reunion.safety, ...next } } }));
  const patchReadiness = (next: Partial<ReunionContext['readiness']>) => setDraft((current) => ({ ...current, reunion: { ...current.reunion, readiness: { ...current.reunion.readiness, ...next } } }));
  const go = (next: StepId) => { setErrors([]); setStepId(next); };

  const moveBack = () => {
    if (currentIndex <= 0) { navigate(tabOrigin, { state: { tabOrigin } }); return; }
    go(steps[currentIndex - 1]);
  };
  const choosePartnerKnowledge = (known: boolean) => {
    setDraft((current) => ({
      ...current,
      partner: known ? current.partner || DEFAULT_PARTNER : { ...DEFAULT_PARTNER },
      reunion: { ...current.reunion, partnerBirthKnown: known, partnerBirthAccuracy: known ? current.reunion.partnerBirthAccuracy : 'unknown' }
    }));
    go(known ? 'partner-date' : 'relationship-start');
  };
  const toggleReason = (reason: ReunionBreakupReason) => {
    const selected = draft.reunion.facts.breakupReasons;
    patchFacts({ breakupReasons: selected.includes(reason) ? selected.filter((item) => item !== reason) : [...selected, reason] });
  };
  const toggleQuestion = (question: ReunionQuestionId) => {
    const selected = draft.reunion.selectedQuestions;
    patchReunion({ selectedQuestions: selected.includes(question) ? selected.filter((item) => item !== question) : selected.length < 5 ? [...selected, question] : selected });
  };
  const confirmName = (kind: 'self' | 'partner') => {
    const name = kind === 'self' ? draft.name.trim() : partner.name.trim();
    if (!name) { setErrors(['이름을 입력한 뒤 확인을 눌러 주세요.']); return; }
    if (kind === 'self') { patch({ name }); go('self-accuracy'); } else { patchPartner({ name }); go('partner-accuracy'); }
  };
  const handleNameEnter = (event: KeyboardEvent<HTMLInputElement>, kind: 'self' | 'partner') => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); confirmName(kind); }
  };
  const submit = () => {
    const checks = Array.from({ length: 7 }, (_, index) => ({ step: index + 1, errors: validateReunionStep(index + 1, draft) }));
    const failed = checks.find((item) => item.errors.length);
    if (failed) { setErrors(failed.errors); setStepId(validationTarget(failed.step, draft)); return; }
    const formData = finalizeReunionIntake(draft);
    saveReunionDraft(formData);
    navigate('/preview/love-reunion', { state: { formData, tabOrigin } });
  };

  const renderStep = () => {
    switch (stepId) {
      case 'self-date':
        return <BirthDate value={draft.birthDate} calendar={draft.calendar} leap={draft.isLeapMonth} onCalendar={(calendar) => patch({ calendar, isLeapMonth: calendar === 'solar' ? false : draft.isLeapMonth })} onLeap={(isLeapMonth) => patch({ isLeapMonth })} onDone={(birthDate) => { patch({ birthDate }); go('self-time'); }} />;
      case 'self-time':
        return <BirthTime value={draft.birthTime} onDone={(birthTime) => { patch({ birthTime, isUnknownTime: false, birthTimePrecision: 'exact' }); go('self-gender'); }} onUnknown={() => { patch({ birthTime: '', isUnknownTime: true, birthTimePrecision: 'unknown' }); go('self-gender'); }} />;
      case 'self-gender':
        return <Choices value={draft.gender} options={[{ value: 'male', label: '남자' }, { value: 'female', label: '여자' }]} onSelect={(gender) => { patch({ gender: gender as 'male' | 'female' }); go('self-name'); }} />;
      case 'self-name':
        return <div className="reunion-micro-name-row"><label className="reunion-micro-line-field"><span className="sr-only">내 이름 또는 호칭</span><input autoFocus maxLength={20} value={draft.name} placeholder="홍길동" onChange={(event) => patch({ name: event.target.value })} onKeyDown={(event) => handleNameEnter(event, 'self')} /></label><button type="button" disabled={!draft.name.trim()} onClick={() => confirmName('self')}><Check size={18} /><span>확인</span></button></div>;
      case 'self-accuracy':
        return <Choices value={draft.reunion.selfBirthAccuracy} options={[{ value: 'documented', label: '서류로 확인했어요', detail: '출생 기록이나 가족 수첩을 봤어요' }, { value: 'remembered', label: '정확히 기억해요', detail: '본인이나 가족이 확실히 기억해요' }, { value: 'approximate', label: '대략 알아요', detail: '한두 시간 정도 오차가 있을 수 있어요' }, { value: 'unknown', label: '전혀 모르겠어요' }]} onSelect={(selfBirthAccuracy) => { patchReunion({ selfBirthAccuracy: selfBirthAccuracy as ReunionContext['selfBirthAccuracy'] }); go('consent'); }} />;
      case 'consent':
        return <div className="reunion-micro-consent"><ul><li><Check size={16} /> 만 19세 이상입니다.</li><li><Check size={16} /> 본인과 상대 정보를 이 재회 분석에 사용하는 데 동의합니다.</li><li><Check size={16} /> 입력한 상대 정보를 사용할 권한이 있음을 확인합니다.</li></ul><button type="button" onClick={() => { patchReunion({ adultConfirmed: true, dataUseConsent: true, dataAuthorityConfirmed: true }); go('partner-known'); }}><ShieldCheck size={19} /> 세 가지 모두 확인하고 동의해요</button></div>;
      case 'partner-known':
        return <Choices value={draft.reunion.partnerBirthKnown ? 'yes' : 'no'} options={[{ value: 'yes', label: '응, 알고 있어', detail: '두 사람 원국과 궁합까지 볼게' }, { value: 'no', label: '아니, 몰라', detail: '내 원국과 확인된 관계 사실로 볼게' }]} onSelect={(value) => choosePartnerKnowledge(value === 'yes')} />;
      case 'partner-date':
        return <BirthDate value={partner.birthDate} calendar={partner.calendar} leap={partner.isLeapMonth} onCalendar={(calendar) => patchPartner({ calendar, isLeapMonth: calendar === 'solar' ? false : partner.isLeapMonth })} onLeap={(isLeapMonth) => patchPartner({ isLeapMonth })} onDone={(birthDate) => { patchPartner({ birthDate }); go('partner-time'); }} />;
      case 'partner-time':
        return <BirthTime value={partner.birthTime} onDone={(birthTime) => { patchPartner({ birthTime, isUnknownTime: false, birthTimePrecision: 'exact' }); go('partner-gender'); }} onUnknown={() => { patchPartner({ birthTime: '', isUnknownTime: true, birthTimePrecision: 'unknown' }); go('partner-gender'); }} />;
      case 'partner-gender':
        return <Choices value={partner.gender} options={[{ value: 'male', label: '남자' }, { value: 'female', label: '여자' }]} onSelect={(gender) => { patchPartner({ gender: gender as 'male' | 'female' }); go('partner-name'); }} />;
      case 'partner-name':
        return <div className="reunion-micro-name-row"><label className="reunion-micro-line-field"><span className="sr-only">상대 이름 또는 호칭</span><input autoFocus maxLength={20} value={partner.name} placeholder="그 사람" onChange={(event) => patchPartner({ name: event.target.value })} onKeyDown={(event) => handleNameEnter(event, 'partner')} /></label><button type="button" disabled={!partner.name.trim()} onClick={() => confirmName('partner')}><Check size={18} /><span>확인</span></button></div>;
      case 'partner-accuracy':
        return <Choices value={draft.reunion.partnerBirthAccuracy} options={[{ value: 'documented', label: '서류로 확인했어요' }, { value: 'remembered', label: '정확히 들었어요' }, { value: 'approximate', label: '대략 알아요' }, { value: 'unknown', label: '정확하지 않아요' }]} onSelect={(partnerBirthAccuracy) => { patchReunion({ partnerBirthAccuracy: partnerBirthAccuracy as ReunionContext['partnerBirthAccuracy'] }); go('relationship-start'); }} />;
      case 'relationship-start':
        return <DateOnly value={draft.reunion.facts.relationshipStartDate} unknown="정확한 날짜는 몰라요" onDone={(relationshipStartDate) => { patchFacts({ relationshipStartDate }); go('breakup-date'); }} />;
      case 'breakup-date':
        return <DateOnly value={draft.reunion.facts.breakupDate} onDone={(breakupDate) => { patchFacts({ breakupDate }); go('breakup-initiator'); }} />;
      case 'breakup-initiator':
        return <Choices value={draft.reunion.facts.breakupInitiator} options={[{ value: 'self', label: '내가 먼저 말했어' }, { value: 'partner', label: '그 사람이 말했어' }, { value: 'mutual', label: '서로 합의했어' }, { value: 'unclear', label: '누가 먼저인지 애매해' }]} onSelect={(breakupInitiator) => { patchFacts({ breakupInitiator: breakupInitiator as ReunionRelationshipFacts['breakupInitiator'] }); go('breakup-reasons'); }} />;
      case 'breakup-reasons':
        return <div className="reunion-micro-multi"><div className="reunion-micro-chip-grid">{reunionBreakupReasonValues.map((reason) => { const selected = draft.reunion.facts.breakupReasons.includes(reason); return <button key={reason} type="button" className={selected ? 'is-selected' : undefined} aria-pressed={selected} onClick={() => toggleReason(reason)}>{selected ? <Check size={14} /> : null}{BREAKUP_LABELS[reason]}</button>; })}</div><Complete label="이유 선택을 마쳤어" disabled={!draft.reunion.facts.breakupReasons.length} onClick={() => go('breakup-detail')} /></div>;
      case 'breakup-detail':
        return <LongText value={draft.reunion.facts.breakupReasonDetail} max={600} placeholder="예: 연락 문제로 자주 다퉜고, 마지막 통화 뒤 그 사람이 헤어지자고 했어." onChange={(breakupReasonDetail) => patchFacts({ breakupReasonDetail })}><Complete label={draft.reunion.facts.breakupReasonDetail.trim() ? '상황 설명을 마쳤어' : '설명 없이 넘어갈게'} onClick={() => go('past-reunions')} /></LongText>;
      case 'past-reunions':
        return <Choices value={String(Math.min(draft.reunion.facts.pastReunionCount, 4))} options={[{ value: '0', label: '한 번도 없어' }, { value: '1', label: '1번' }, { value: '2', label: '2번' }, { value: '3', label: '3번' }, { value: '4', label: '4번 이상' }]} onSelect={(value) => { patchFacts({ pastReunionCount: Number(value) }); go('repeated-cause'); }} />;
      case 'repeated-cause':
        return <Choices value={draft.reunion.facts.repeatedCause ? 'yes' : 'no'} options={[{ value: 'yes', label: '응, 같은 이유였어' }, { value: 'no', label: '아니, 이번은 달라' }]} onSelect={(value) => { patchFacts({ repeatedCause: value === 'yes' }); go('last-contact-date'); }} />;
      case 'last-contact-date':
        return <DateOnly value={draft.reunion.facts.lastContactDate} unknown="정확한 날짜는 몰라" onDone={(lastContactDate) => { patchFacts({ lastContactDate }); go('last-contact-mood'); }} />;
      case 'last-contact-mood':
        return <Choices value={draft.reunion.facts.lastContactMood} options={[{ value: 'warm', label: '다정했어' }, { value: 'neutral', label: '담담했어' }, { value: 'cold', label: '차가웠어' }, { value: 'conflict', label: '다투며 끝났어' }]} onSelect={(lastContactMood) => { patchFacts({ lastContactMood: lastContactMood as ReunionRelationshipFacts['lastContactMood'] }); go('contact-frequency'); }} />;
      case 'contact-frequency':
        return <Choices value={draft.reunion.facts.contactFrequency} options={[{ value: 'none', label: '전혀 연락하지 않아' }, { value: 'rare', label: '가끔 안부만 물어' }, { value: 'weekly', label: '주 1회쯤 연락해' }, { value: 'frequent', label: '자주 연락해' }]} onSelect={(contactFrequency) => { patchFacts({ contactFrequency: contactFrequency as ReunionRelationshipFacts['contactFrequency'] }); go('block-state'); }} />;
      case 'block-state':
        return <Choices value={draft.reunion.facts.blockState} options={[{ value: 'none', label: '차단 없음' }, { value: 'self-blocked', label: '내가 차단했어' }, { value: 'partner-blocked', label: '상대가 나를 차단했어' }, { value: 'mutual', label: '서로 차단했어' }]} onSelect={(blockState) => { patchFacts({ blockState: blockState as ReunionRelationshipFacts['blockState'] }); go('new-relationship'); }} />;
      case 'new-relationship':
        return <Choices value={draft.reunion.facts.newRelationship} options={[{ value: 'none', label: '확인된 새 사람은 없어' }, { value: 'self', label: '내게 새 사람이 있어' }, { value: 'partner', label: '상대에게 새 사람이 있어' }, { value: 'both', label: '둘 다 새 사람이 있어' }]} onSelect={(newRelationship) => { patchFacts({ newRelationship: newRelationship as ReunionRelationshipFacts['newRelationship'] }); go('distance'); }} />;
      case 'distance':
        return <Choices value={draft.reunion.facts.distance} options={[{ value: 'same-area', label: '같은 지역' }, { value: 'domestic-distance', label: '국내 장거리' }, { value: 'overseas', label: '해외' }, { value: 'unknown', label: '잘 모르겠어' }]} onSelect={(distance) => { patchFacts({ distance: distance as ReunionRelationshipFacts['distance'] }); go('obstacles'); }} />;
      case 'obstacles':
        return <div className="reunion-micro-multi"><div className="reunion-micro-chip-grid">{OBSTACLES.map(({ key, label }) => { const selected = draft.reunion.facts[key]; return <button key={key} type="button" className={selected ? 'is-selected' : undefined} aria-pressed={selected} onClick={() => patchFacts({ [key]: !selected })}>{selected ? <Check size={14} /> : null}{label}</button>; })}</div><Complete label="현실 장벽을 확인했어" onClick={() => go('safety')} /></div>;
      case 'safety':
        return <div className="reunion-micro-multi"><aside className="reunion-micro-safety-callout"><ShieldCheck size={23} /><p>하나라도 해당되면 재회보다 안전이 먼저야. 연락·접근을 권하지 않는 결과가 나올 수 있어.</p></aside><div className="reunion-micro-check-list">{SAFETY.map(({ key, label }) => { const selected = draft.reunion.safety[key]; return <button key={key} type="button" className={selected ? 'is-selected is-danger' : undefined} aria-pressed={selected} onClick={() => patchSafety({ [key]: !selected })}><i>{selected ? <Check size={14} /> : null}</i><span>{label}</span></button>; })}</div><Complete label="안전 신호를 확인했어" onClick={() => go('readiness-check')} /></div>;
      case 'readiness-check':
        return <div className="reunion-micro-multi"><div className="reunion-micro-check-list">{READINESS.map(({ key, label }) => { const selected = draft.reunion.readiness[key]; return <button key={key} type="button" className={selected ? 'is-selected' : undefined} aria-pressed={selected} onClick={() => patchReadiness({ [key]: !selected })}><i>{selected ? <Check size={14} /> : null}</i><span>{label}</span></button>; })}</div>{!draft.reunion.readiness.canRespectBoundary ? <p className="reunion-micro-inline-error">거절과 차단을 존중할 수 있어야 다음 분석으로 갈 수 있어.</p> : null}<Complete label="내 준비 상태를 확인했어" disabled={!draft.reunion.readiness.canRespectBoundary} onClick={() => go('readiness-level')} /></div>;
      case 'readiness-level':
        return <Choices value={draft.reunion.readiness.level} options={[{ value: 'ready', label: '준비됐어', detail: '어떤 답이 와도 경계를 지킬 수 있어' }, { value: 'shaky', label: '조금 흔들려', detail: '답이 없거나 거절하면 힘들 것 같아' }, { value: 'not-ready', label: '아직 준비 안 됐어', detail: '지금은 내 회복을 먼저 하고 싶어' }]} onSelect={(level) => { patchReadiness({ level: level as ReunionContext['readiness']['level'] }); go('desired-outcome'); }} />;
      case 'desired-outcome':
        return <Choices value={draft.reunion.desiredOutcome} options={[{ value: 'reunion', label: '다시 만나고 싶어' }, { value: 'conversation', label: '솔직히 대화하고 싶어' }, { value: 'apology', label: '사과를 전하고 싶어' }, { value: 'closure', label: '잘 정리하고 싶어' }, { value: 'undecided', label: '아직 모르겠어' }]} onSelect={(desiredOutcome) => { patchReunion({ desiredOutcome: desiredOutcome as ReunionContext['desiredOutcome'] }); go('feared-outcome'); }} />;
      case 'feared-outcome':
        return <LongText value={draft.reunion.fearedOutcome} max={300} rows={3} placeholder="예: 또 같은 이유로 헤어질까 봐 두려워." onChange={(fearedOutcome) => patchReunion({ fearedOutcome })}><Complete label={draft.reunion.fearedOutcome.trim() ? '두려운 점을 적었어' : '지금은 적지 않을게'} onClick={() => go('questions')} /></LongText>;
      case 'questions':
        return <div className="reunion-micro-multi"><div className="reunion-micro-question-count"><strong>{draft.reunion.selectedQuestions.length}</strong><span>/ 5 선택</span></div><div className="reunion-micro-check-list is-question-list">{reunionQuestionValues.map((question) => { const selected = draft.reunion.selectedQuestions.includes(question); return <button key={question} type="button" className={selected ? 'is-selected' : undefined} aria-pressed={selected} onClick={() => toggleQuestion(question)}><i>{selected ? <Check size={14} /> : null}</i><span>{QUESTION_LABELS[question]}</span></button>; })}</div><Complete label="궁금한 걸 다 골랐어" disabled={draft.reunion.selectedQuestions.length < 3 || draft.reunion.selectedQuestions.length > 5} onClick={() => go('custom-question')} /></div>;
      case 'custom-question':
        return <LongText value={draft.reunion.customQuestion} max={300} rows={3} placeholder="예: 상대에게 새로운 인연이 있을까?" onChange={(customQuestion) => patchReunion({ customQuestion })}><Complete label={draft.reunion.customQuestion.trim() ? '추가 질문을 적었어' : '추가 질문은 없어요'} onClick={() => go('message-draft')} /></LongText>;
      case 'message-draft':
        return <LongText value={draft.reunion.messageDraft} max={1000} rows={5} placeholder="보내고 싶은 말을 있는 그대로 적어도 괜찮아." onChange={(messageDraft) => patchReunion({ messageDraft })}><Complete label={draft.reunion.messageDraft.trim() ? '메시지를 점검할게' : '메시지 없이 넘어갈게'} onClick={() => go('attempted-contact')} /></LongText>;
      case 'attempted-contact':
        return <LongText value={draft.reunion.attemptedContactSummary} max={600} placeholder="예: 지난주에 카카오톡으로 한 번 안부를 물었지만 답장은 없었어." onChange={(attemptedContactSummary) => patchReunion({ attemptedContactSummary })}><Complete final label="내 재회운 보러 가기" onClick={submit} /></LongText>;
      default:
        return null;
    }
  };

  return (
    <main className="reunion-micro-intake">
      <div className="reunion-micro-background" aria-hidden="true">
        {videoFailed ? <img src={BACKGROUND_POSTER} alt="" /> : <video autoPlay muted loop playsInline preload="auto" poster={BACKGROUND_POSTER} onError={() => setVideoFailed(true)}><source src={BACKGROUND_VIDEO} type="video/mp4" /></video>}
        <span />
      </div>
      <header className="reunion-micro-header">
        <div><button type="button" onClick={moveBack} aria-label={currentIndex === 0 ? '재회운 상세로 돌아가기' : '이전 질문'}><ArrowLeft size={25} /></button><strong>MZ도깨비 재회사주</strong><span aria-hidden="true" /></div>
        <div className="reunion-micro-progress" role="progressbar" aria-label="재회운 입력 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{ width: `${progress}%` }} /></div>
      </header>
      <section className="reunion-micro-content" key={stepId} aria-live="polite">
        <div className="reunion-micro-copy"><h1>{COPY[stepId][0]}</h1><p>{COPY[stepId][1]}</p></div>
        {renderStep()}
        {errors.length ? <div className="reunion-micro-error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      </section>
    </main>
  );
}
