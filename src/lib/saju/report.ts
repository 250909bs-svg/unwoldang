import type { ServiceId } from '../../api/mockData';
import type { ReunionReportPayload } from '../reunion/reportTypes';

export type ReportKind = 'comprehensive' | 'yearly' | 'love' | 'reunion' | 'marriage' | 'compatibility' | 'career' | 'wealth';
type CardTone = 'default' | 'good' | 'warn';
export type FiveElement = '목' | '화' | '토' | '금' | '수';

export interface PastLifePortrait {
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  role: string;
  appearance: string[];
  attire: string;
  gaze: string;
  caption: string;
}

export interface PastLifeStoryBeat {
  title: string;
  scene: string;
  goblinLine: string;
  presentEcho: string;
}

export interface PastLifeProfile {
  version: 'past-life-profile-v2';
  seed: number;
  sealName: string;
  archetype: string;
  eraMood: string;
  place: string;
  vocation: string;
  keepsake: string;
  openingLine: string;
  customerFocus: string;
  repeatedScene: string;
  frequentEmotion: string;
  hiddenDesire: string;
  readingTone: string;
  selfPortrait: PastLifePortrait;
  connectionPortrait: PastLifePortrait;
  connectionRole: string;
  firstMeeting: string;
  unfinishedPromise: string;
  finalSeparation: string;
  presentEcho: string;
  evidence: string[];
  storyBeats: PastLifeStoryBeat[];
  disclaimer: string;
}

export interface ReportCard {
  title: string;
  body: string;
  tone?: CardTone;
  badge?: string;
}

export interface ReportDetail {
  summary: string;
  content: string;
  open?: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullets?: string[];
  cards?: ReportCard[];
  details?: ReportDetail[];
  callout?: {
    title?: string;
    body: string;
  };
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface QuestionAnswerBlock {
  question: string;
  title: string;
  analysis: string;
  advice: string[];
}

export interface YearLuckItem {
  year: number;
  ganzhi: string;
  score: number;
  headline: string;
  summary: string;
  focus: string;
  warning: string;
}

export interface MonthLuckItem {
  year: number;
  month: number;
  ganzhi: string;
  score: number;
  summary: string;
  focus: string;
  warning: string;
  validFrom?: string;
  validTo?: string;
}

export interface FortuneWindow {
  name: string;
  range: string;
  summary: string;
  focus: string;
  caution: string;
  /**
   * 대운 시작·종료 시각(ISO). `DayunData.startsAt`/`endsAt` 를 그대로 싣는다.
   *
   * `range` 는 `30세 ~ 39세` 형태의 **나이 문자열**이고, 입운이 정수 나이가 아니라
   * 소수 나이(절기 기준 시각)에서 시작하므로 `생년 + 시작 나이` 로 연도를 되짚으면
   * 실제 구간과 최대 2년까지 어긋난다. 연도 표기가 필요한 화면은 이 두 값만 쓴다.
   * 첫 대운 진입 전처럼 대응하는 행이 없으면 비운다.
   */
  startsAt?: string;
  endsAt?: string;
}

export interface ActionPlan {
  title: string;
  priorities: string[];
  dos: string[];
  avoids: string[];
  luckyDays: { day: number; reason: string }[];
  unluckyDays: { day: number; reason: string }[];
}

export interface VisibleTenGodReading {
  pillar: string;
  stem: string;
  stemHanja: string;
  stemTenGod: string;
  branch: string;
  branchHanja: string;
  branchMainStem: string;
  branchTenGod: string;
  reading: string;
}

export interface ReportQualityScoreItem {
  label: string;
  score: number;
  max: number;
}

export interface ReportQualityAudit {
  score: number;
  status: 'pass' | 'warn';
  items: ReportQualityScoreItem[];
  warnings: string[];
  repeatedSentences: string[];
  bannedTerms: string[];
  typoSignals: string[];
}

export interface ReportEngineMeta {
  engineVersion: string;
  validationStatus: string;
  calendarVersion: string;
  interpretationVersion: string;
  interactionVersion: string;
  calculationPrecision: 'exact-minute' | 'legacy-range' | 'unknown';
  scenarioCount: number;
  dayBoundaryPolicy: 'civil-midnight' | 'late-zi-next-day';
  trueSolarTime: {
    requested: boolean;
    applied: boolean;
    correctionMinutes: number | null;
  };
  evidenceCount: number;
  confidence: number | null;
  releaseDecision: 'eligible' | 'manual-review-required' | 'blocked';
  releaseAuditVersion: string;
  reproducibilityFingerprint: string;
  evidenceCoverage: {
    score: number;
    passed: number;
    total: number;
  };
  externalCalendarStatus:
    | 'matched'
    | 'mismatched'
    | 'verified-date-only'
    | 'not-comparable-policy'
    | 'not-configured'
    | 'failed';
  releaseBlockers: string[];
  reviewFlags: string[];
  infoFlags: string[];
  yongsinConsensusStatus: 'confirmed' | 'preferred' | 'mixed' | 'deferred';
  climateTemperature: 'cold' | 'balanced' | 'hot' | null;
  climateMoisture: 'dry' | 'balanced' | 'wet' | null;
  uncertainty: string[];
  aiUsage?: {
    provider: 'gemini';
    model: string;
    promptTokenCount: number;
    candidatesTokenCount: number;
    thoughtsTokenCount: number;
    cachedContentTokenCount: number;
    totalTokenCount: number;
  };
  /**
   * 제미나이 산문 필드별 채택/거부 관측 카운터.
   *
   * `lockCommercialReportFacts` 가 engineMeta 를 base 값으로 통째 복원하므로
   * 이 값은 **lock 이후에** 주입된다(`aiUsage` 와 같은 위치).
   *
   * 거부 사유 키는 ASCII 코드로만 짓는다. 이유를 정확히 적어 둔다 —
   * 프로덕션 주입 순서에서 `findLoveReunionSafetyViolations` 는 lock·검사가 끝난
   * **뒤에** 주입되는 이 값을 보지 않으므로, 한국어 사유를 넣어도 지금은 가드를
   * 트립시키지 않는다. ASCII 규약은 **주입 위치가 앞으로 옮겨질 경우를 대비한 계약**이다
   * (`findLoveReunionSafetyViolations` 는 engineMeta 를 포함한 리포트 전체를
   * `JSON.stringify` 로 검사한다). 이전 주석·ADR 이 "가드가 검사하므로" 라고 적은 것은
   * 실제 순서와 어긋났다.
   */
  aiFields?: {
    mode: 'strict-echo' | 'authored';
    accepted: number;
    rejected: number;
    rejectionsByReason: Record<string, number>;
    /**
     * 병합 후 검사를 통과시키려고 base 로 되돌린 필드 계열.
     * 비어 있으면 첫 시도에 통과했다는 뜻이다.
     */
    revertedFamilies?: string[];
    /**
     * 재회운 컷 카피는 리포트 본문과 다른 경로로 검증되므로 카운터도 따로 낸다.
     * 사유 코드가 본문과 겹치는데(`missing-citation` 등) 합치면 어느 단계가
     * 막고 있는지 구분이 사라진다.
     */
    cuts?: {
      accepted: number;
      rejected: number;
      rejectionsByReason: Record<string, number>;
    };
  };
  helpfulElementSource: 'expert-consensus' | 'legacy-fallback';
}

export interface SajuReportData {
  serviceId: ServiceId;
  kind: ReportKind;
  title: string;
  subtitle: string;
  badge: string;
  serialNumber: string;
  createdAt: string;
  birthLabel: string;
  questionPreview: string;
  customerName: string;
  zodiac: string;
  dayMaster: string;
  dayMasterElement: FiveElement;
  strengthLabel: string;
  helpfulElements: FiveElement[];
  cautiousElements: FiveElement[];
  gyeokguk: string;
  heroNote: string;
  keyTakeaways: ReportCard[];
  currentDayun: FortuneWindow;
  nextDayun: FortuneWindow;
  legalNotice: string[];
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  fiveElements: Array<{ label: FiveElement; value: number; color: string }>;
  tenGods: Array<{ label: string; value: number }>;
  visibleTenGods: VisibleTenGodReading[];
  tenGodBasisNote: string;
  metaGrid: Array<{ label: string; value: string }>;
  summary: {
    title: string;
    analysis: string[];
    advice: string[];
  };
  questionAnswers: QuestionAnswerBlock[];
  sections: ReportSection[];
  yearLuck: YearLuckItem[];
  monthLuck: MonthLuckItem[];
  actionPlan: ActionPlan;
  qualityAudit: ReportQualityAudit;
  engineMeta?: ReportEngineMeta;
  pastLifeProfile?: PastLifeProfile;
  /**
   * 재회운 웹툰형 8장 × 컷 페이로드 (명세 §5).
   *
   * additive 옵셔널 필드다. `sections` 를 대체하지 않고 병행하므로, 조립 배선이
   * 아직 없는 동안에도(= 현재) 나머지 경로가 전혀 달라지지 않는다.
   * `lockCommercialReportFacts` 가 base 값으로 통째 복원하므로 판정·집계·날짜·컷 구조는
   * 제미나이가 바꿀 수 없고, 컷 대사만 `geminiReunionCopy.ts` 가 컷 단위로 검증해 덮어쓴다.
   */
  reunion?: ReunionReportPayload;
}
