/**
 * 제미나이 산문 3단 검증 (명세 §4-1 a).
 *
 * 이 파일은 **프롬프트를 풀기 전에 먼저 서 있어야 하는 코드 안전망**이다.
 * 지금까지 `geminiReportService.ts` 는 모델이 돌려준 모든 산문을 결정론 `baseReport` 와
 * 바이트 단위로 비교했고(`validateGeneratedProse`), 한 글자만 달라도 전체 draft 가 버려졌다.
 * 그 잠금을 풀려면 "무엇을 써도 되는가" 를 문장 단위로 판정할 장치가 먼저 있어야 한다.
 *
 * 3단 구성:
 *   ① 범위 검사 — 기존 `questionEvidenceScopes` / `sectionEvidenceScopes` 를 그대로 재사용한다.
 *      이 파일은 손대지 않는다.
 *   ② 엔티티 화이트리스트 — 여기. `deterministicBasis` + `baseReport` 에 **실재하는 값** 집합을
 *      만들고, 모델 문장에서 뽑은 간지·십성·십이운성·연도·월·퍼센트·점수가 전부 그 집합에
 *      속하는지만 본다. 집합 밖의 값이 나오면 그 필드만 거부한다.
 *   ③ 금지 표현 선검사 — 여기. 재회 안전 가드와 고객 문장 가드를 **병합 후가 아니라 draft
 *      단계에서 먼저** 돌린다.
 *
 * ## 설계 원칙 두 가지
 *
 * **(1) 집합은 관대하게, 검사는 엄격하게.**
 * 실재 값 집합(`EntityUniverse`)은 JSON 직렬화 전체를 관대한 추출기로 훑어 만든다.
 * 모델 문장은 오탐이 적은 엄격한 추출기로 훑는다. 집합이 항상 검사 대상의 상위집합이 되므로
 * "실재하는데 집합에 없어서 거부" 라는 사고가 구조적으로 생기지 않는다.
 *
 * **(2) 모델이 '새로' 만든 위반만 잡는다.**
 * 결정론 base 문구 자체가 어떤 패턴에 걸리는 경우가 있다(예: 재회 리포트의 핵심 카피
 * `확률이 아니라 조건 개수예요.` 는 `%` 금지 규칙과 같은 표에서 나온다). base 에 이미 있던
 * 위반을 모델 탓으로 돌리면 정상 echo 까지 거부되므로, base 대비 **새로 생긴 위반만** 센다.
 */

import type { DeterministicSajuBasis } from '../saju/deterministicBasis';
import type { SajuReportData } from '../saju/report';
import { findLoveReunionSafetyTextViolations, LOVE_REUNION_HERO_NOTE } from '../saju/reportBuilder';
import { findCustomerTextPatternViolations } from '../saju/reportPresentation';
import { findReunionBannedPhrases } from '../reunion/bannedPhrases';
import { resolveReunionAgeBand, type ReunionAgeBand } from '../reunion/ageBand';
import { proseGuardModeForServiceId } from '../saju/promptRelease';
import { REUNION_UNDELETABLE_COPY } from '../reunion/safetyCopy';
import { isReunionSupportRoutingReady } from '../reunion/safetyCopy';
import type { ReunionContext } from '../reunion/types';
import {
  isContactWithheld,
  reunionIntentLabels,
  toReunionIntentContext,
  type ReunionIntentContext
} from './reunionIntentGuard';

/**
 * `strict-echo` — 기존 동작. 결정론 문구와 바이트 단위로 같아야 한다.
 * `authored` — 3단 검증. 모델이 문장을 직접 쓰되 사실 주장은 결정론 값에 고정된다.
 *
 * 상품별로 따로 잡는다(명세 §4-7). 재회운만 먼저 열고 나머지는 현행 유지한다.
 */
export type ProseGuardMode = 'strict-echo' | 'authored';

export interface ProseGuardModeInput {
  serviceId: SajuReportData['serviceId'];
  /** 유료 요청의 재회 맥락. 없으면 맥락 없는 기본 판정이다. */
  reunionContext?: ReunionContext | null;
  /** 독자가 자유 서술한 유료 질문. 학대 신호를 여기서도 찾는다. */
  questions?: readonly string[];
}

/**
 * 어느 상품·어느 독자에게 산문 권한을 주는가.
 *
 * 재회운이라도 **학대·통제·위협 신호가 있는 독자에게는 authored 모드를 주지 않는다.**
 * 이유는 두 가지다:
 *   - `REUNION_SUPPORT_CONTACT` 가 아직 `null` 이라 상담 착지점이 없다
 *     (`safetyCopy.ts:253`). 감지는 되는데 안내할 곳이 없는 상태에서 모델이
 *     자유 문장을 쓰면, 가장 위험한 독자에게 가장 검증이 덜 된 문장이 간다.
 *   - CH00 게이트(`gate.ts:91`)는 클라이언트에만 있고 서버는 게이트 판정을 모른다.
 *     결정론 계층에는 고정 경계 카피가 있었으므로, 이 경로에서 해제하면 **순수하게
 *     나빠진다.**
 * 착지점이 채워지고 게이트가 서버로 올라오면 이 분기를 다시 검토한다.
 */
export function resolveProseGuardMode(input: ProseGuardModeInput): ProseGuardMode {
  if (proseGuardModeForServiceId(input.serviceId) !== 'authored') return 'strict-echo';
  const intent = toReunionIntentContext(input.reunionContext, input.questions || []);
  if (intent.harmSignalDetected && !isReunionSupportRoutingReady()) return 'strict-echo';
  return 'authored';
}

export function proseGuardModeFor(serviceId: SajuReportData['serviceId']): ProseGuardMode {
  return resolveProseGuardMode({ serviceId });
}

/**
 * 밴드 판정.
 *
 * `reportBuilder` 가 아직 `SajuReportData.reunion` 을 싣지 않으므로
 * 페이로드가 있으면 그 값을, 없으면 정규화 생일 + 기준 시각으로 직접 계산한다.
 * 밴드를 못 넘기던 것이 밴드별 금지어(teen 5개 · thirties 5개 등)가 모델 문장 검사와
 * 프롬프트 직렬화 양쪽에서 통째로 빠져 있던 원인이다.
 */
export function resolveGuardAgeBand(
  basis: DeterministicSajuBasis | null | undefined,
  base: SajuReportData
): ReunionAgeBand {
  if (base.reunion?.ageBand) return base.reunion.ageBand;
  return resolveReunionAgeBand({
    birthDate: basis?.input.birthDate || null,
    referenceInstant: basis?.commercialV2?.generatedFor?.instant || base.createdAt || null
  }).ageBand;
}

/* ------------------------------------------------------------------ *
 * ② 엔티티 화이트리스트
 * ------------------------------------------------------------------ */

export type EntityKind =
  | 'ganzhi'
  | 'tenGod'
  | 'twelveStage'
  | 'year'
  | 'month'
  | 'percent'
  | 'score'
  | 'relation';

export interface EntityUniverse {
  ganzhi: ReadonlySet<string>;
  tenGod: ReadonlySet<string>;
  twelveStage: ReadonlySet<string>;
  year: ReadonlySet<string>;
  month: ReadonlySet<string>;
  /** 퍼센트·점수는 같은 수치 집합을 공유한다. 표기만 다를 뿐 같은 계산값이다. */
  number: ReadonlySet<string>;
  /**
   * 지지 관계 라벨(`자오충` · `자축합` · `묘신원진` …).
   *
   * `basis.commercialV2` 의 관계 탐지 결과는 한국어 `name`/`subtype` 을 그대로 싣는다
   * (`interactions/relations.ts:53-101`). 그래서 실재 관계는 basis 직렬화에서 전부 잡힌다.
   * 반대로 엔진이 **계산하지 않는** 개념(공망·백호·귀문·삼형·양인 등)은 집합을 만들
   * 근거가 없으므로 화이트리스트가 아니라 `reunionIntentGuard` 의 전량 금지로 막는다.
   */
  relation: ReadonlySet<string>;
}

const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;
const STEMS_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;

/**
 * 십이운성 12개 중 **다의어가 아닌 5개만** 쓴다.
 *
 * 명세의 출발 패턴은 `장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양` 이었는데,
 * 뒤쪽 7개는 전부 한 글자라 평범한 한국어 문장에서 끝없이 오탐한다
 * (`사`람 / `병`원 / `양`쪽 / `태`도 / `묘`한). 한 글자 운성은 `십이운성`·`12운성`
 * 이라는 명시적 문맥이 앞에 있을 때만 잡는다(`TWELVE_STAGE_IN_CONTEXT`).
 */
const TWELVE_STAGES_UNAMBIGUOUS = ['장생', '목욕', '관대', '건록', '제왕'] as const;
const TWELVE_STAGES_ALL = [
  '장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'
] as const;

const KO_TO_HANJA: Record<string, string> = {};
const HANJA_TO_KO: Record<string, string> = {};
STEMS_KO.forEach((stem, index) => {
  KO_TO_HANJA[stem] = STEMS_HANJA[index];
  HANJA_TO_KO[STEMS_HANJA[index]] = stem;
});
BRANCHES_KO.forEach((branch, index) => {
  KO_TO_HANJA[branch] = BRANCHES_HANJA[index];
  HANJA_TO_KO[BRANCHES_HANJA[index]] = branch;
});

/** 간지 한 쌍을 한글/한자 두 표기로 펼친다. 집합에는 항상 두 표기를 함께 넣는다. */
function ganzhiVariants(pair: string): string[] {
  const [first, second] = [...pair];
  if (!first || !second) return [pair];
  const ko = `${HANJA_TO_KO[first] || first}${HANJA_TO_KO[second] || second}`;
  const hanja = `${KO_TO_HANJA[first] || first}${KO_TO_HANJA[second] || second}`;
  return [...new Set([pair, ko, hanja])];
}

const STEM_CLASS = `${STEMS_KO.join('')}${STEMS_HANJA.join('')}`;
const BRANCH_CLASS = `${BRANCHES_KO.join('')}${BRANCHES_HANJA.join('')}`;

const GANZHI_HANJA_RE = new RegExp(
  `[${STEMS_HANJA.join('')}][${BRANCHES_HANJA.join('')}]`,
  'gu'
);

/**
 * 한글 간지는 평범한 단어와 정면으로 겹친다 — `임신`(pregnancy), `무술`(martial art),
 * `병자`(patient), `신축`(new build), `정오`(noon), `기사`(article), `신사`(gentleman).
 * 문맥 없이 잡으면 모델이 평범한 한국어를 썼다는 이유로 필드가 조용히 거부된다.
 * 그래서 **명시적 간지 문맥이 있을 때만** 엔티티로 본다.
 *
 * ## 처음 구현이 뚫린 지점 (검증 실측)
 *
 * `[간][지]` 뒤에 접미사가 **바로** 붙은 형태만 검사했기 때문에, 존재하지 않는 간지를
 * 자연스러운 한국어로 주장하는 가장 흔한 여섯 형태가 전부 무검사 통과했다:
 * `'갑자 년에는'`(접미사 앞 공백) · `'갑자 흐름이'`(접미사 없음) · `'甲자년에는'`(혼용) ·
 * `'갑 자년에는'`(간지 사이 공백) · `'올해 간지는 갑자입니다'` · `'갑자 기운이'`.
 *
 * 그래서 네 갈래로 검사한다:
 *   (a) 접미사형 — 간지 사이 공백 허용, 접미사 앞 공백 허용, 한자/한글 혼용 허용
 *   (b) 혼용형   — 천간·지지 중 한쪽만 한자면 평범한 한국어가 아니다. 접미사 불요.
 *   (c) 후행 문맥형 — `갑자 기운` · `갑자 흐름`
 *   (d) 선행 문맥형 — `올해 간지는 갑자`
 *
 * 오탐 방지는 접미사 목록이 아니라 **'집합 밖 + 근접 명리 문맥어'** 조건이 담당한다.
 * `임신`·`무술`·`정오`·`기사`·`신사` 는 근접 문맥어가 없으면 (a)~(d) 어디에도 걸리지 않는다.
 */
const GANZHI_SUFFIX = '일주|월주|년주|시주|대운|세운|월운|년|월|일|시|주|운';
/** 근접 명리 문맥어. 짧게 유지한다 — 넓히면 평범한 문장이 검사 대상이 된다. */
const GANZHI_CONTEXT_WORD = '간지|명식|원국|기운|흐름|오행|일주|월주|년주|시주|대운|세운|월운';

/** (a) 접미사형. 간지 두 글자 사이와 접미사 앞에 공백을 허용한다. */
const GANZHI_SUFFIXED_RE = new RegExp(
  `(?<![가-힣])([${STEM_CLASS}])\\s?([${BRANCH_CLASS}])\\s?(?:${GANZHI_SUFFIX})`,
  'gu'
);

/** (b) 한자/한글 혼용형. 혼용은 평범한 한국어에 나타나지 않으므로 접미사를 요구하지 않는다. */
const GANZHI_MIXED_RE = new RegExp(
  `(?<![가-힣])(?:([${STEMS_HANJA.join('')}])\\s?([${BRANCHES_KO.join('')}])` +
  `|([${STEMS_KO.join('')}])\\s?([${BRANCHES_HANJA.join('')}]))`,
  'gu'
);

/** (c) 후행 문맥형 — `갑자 기운이 들어옵니다`. */
const GANZHI_TRAILING_CONTEXT_RE = new RegExp(
  `(?<![가-힣])([${STEMS_KO.join('')}])\\s?([${BRANCHES_KO.join('')}])(?![가-힣])\\s{0,2}(?:${GANZHI_CONTEXT_WORD})`,
  'gu'
);

/**
 * (d) 선행 문맥형 — `올해 간지는 갑자입니다`.
 *
 * 여기서는 뒤쪽 한글 금지 조건을 쓸 수 없다. 한국어는 명사 뒤에 서술격이 붙으므로
 * `(?![가-힣])` 를 걸면 `갑자입니다` 가 검출되지 않는다(실측으로 걸렸던 지점).
 * 대신 **서술격·조사만** 허용해 `갑자기`(부사) 같은 동형 일상어를 배제한다.
 */
const GANZHI_TAIL =
  '(?=$|[\\s.,!?)\\]·”"\']|입니다|입니|이에요|예요|이고|이며|이라|였|은|는|이|가|을|를|로|으로|와|과|의|에|도|만)';
const GANZHI_LEADING_CONTEXT_RE = new RegExp(
  `(?:${GANZHI_CONTEXT_WORD})[^.!?\\n]{0,6}?(?<![가-힣])([${STEMS_KO.join('')}])\\s?([${BRANCHES_KO.join('')}])${GANZHI_TAIL}`,
  'gu'
);

/** 집합 구축용(관대). 문맥 없는 한글 간지도 전부 받는다. */
const GANZHI_KO_BARE_RE = new RegExp(
  `(?<![가-힣])([${STEMS_KO.join('')}][${BRANCHES_KO.join('')}])(?![가-힣])`,
  'gu'
);

const TEN_GOD_RE = new RegExp(`(?:${TEN_GODS.join('|')})`, 'gu');
/**
 * 십이운성 뒤에 **한국어 조사와 서술격 어미를 허용한다.**
 *
 * 처음 구현은 후행 부정 탐색 `(?![가-힣])` 를 썼는데, 한국어 명사 뒤에는 거의 항상
 * 조사가 붙으므로(`제왕의` · `제왕입니다` · `장생의`) 검출이 거의 전부 사라졌다.
 * 실측: `'제왕 자리에'`(공백)만 잡히고 `'제왕의 자리에'` · `'제왕입니다'` 는 통과했다.
 * 다의어 회피용으로 남긴 '무조건 검사 5개' 조차 실효가 없었다는 뜻이다.
 */
const STAGE_TAIL = `(?=$|[\\s.,!?)\\]·”"']|의|이|가|은|는|을|를|에|와|과|으로|로|입니다|이라|라|이고|이며|였)`;
const TWELVE_STAGE_RE = new RegExp(
  `(?<![가-힣])(?:${TWELVE_STAGES_UNAMBIGUOUS.join('|')})${STAGE_TAIL}`,
  'gu'
);
/**
 * 한 글자 운성(쇠·병·사·묘·절·태·양)은 `사람`·`병원`·`양쪽`·`태도`·`묘한` 과 정면으로
 * 겹치므로 명시 문맥이 있을 때만 잡는다. 문맥은 `십이운성`/`12운성` 접두 외에
 * `자리|구간|국면|단계` 근접어까지 받는다 — 실측에서 `'지금은 절의 자리라'` ·
 * `'태의 국면이라'` · `'쇠의 구간이'` 가 전부 통과했다.
 */
const TWELVE_STAGE_IN_CONTEXT_RE = new RegExp(
  `(?:십이운성|12운성)[^\\n]{0,10}?(${TWELVE_STAGES_ALL.join('|')})${STAGE_TAIL}`,
  'gu'
);
const TWELVE_STAGE_NEAR_PHASE_RE = new RegExp(
  `(?<![가-힣])(${TWELVE_STAGES_ALL.join('|')})(?:의|은|는|이|가|에)?\\s{0,2}(?:자리|구간|국면|단계)`,
  'gu'
);

/**
 * 지지 관계 라벨. 실재 여부를 basis 집합과 대조한다.
 *
 * 처음 구현에는 이 계층이 **아예 없었다** — `EntityKind` 가 7종뿐이라
 * `'일지와 월지가 정면으로 충하고 있어'` · `'일주가 천간합을 이루어'` 같은
 * 지어낸 관계 주장이 검사 대상 자체가 아니었다.
 *
 * 두 갈래로 잡는다:
 *   (a) 완성 라벨형 — `자오충` · `자축합` · `묘신원진` · `갑기합` · `갑경충`
 *       (천간 또는 지지 2자 + 관계어). **이쪽이 실효 방어다.**
 *       천간 관계도 엔진이 계산한다(`relations.ts:41-50` `stem-combination`/`stem-clash`).
 *   (b) 관계 서술형 — `충하고` · `합을 이루` · `형이 걸려` (관계어 + 서술)
 *       라벨을 만들 수 없으므로 **관계 종류 자체가 basis 에 있는지**만 본다.
 *       종류 토큰(`합`·`충`)은 거의 항상 basis 에 있으므로 (b)는 superset 검사다 —
 *       `'천간합을 이루어'` 처럼 종류만 말하는 주장은 이 계층으로 막히지 않는다.
 *       막는 것은 (a)이고, 그래서 라벨의 조사 허용이 중요하다.
 */
const RELATION_KIND = '충|합|형|파|해|원진';
/*
 * 후행 조건은 `(?![가-힣])` 가 아니라 조사·서술격 허용이다. `'인해합이 걸려 있어'` 처럼
 * 조사가 붙으면(한국어에서는 거의 항상 붙는다) 검출이 사라진다.
 * 대신 허용 목록으로 `'자유파티'` 같은 동형 우연 일치를 배제한다.
 */
const RELATION_LABEL_RE = new RegExp(
  `(?<![가-힣])([${STEMS_KO.join('')}${BRANCHES_KO.join('')}]` +
  `[${STEMS_KO.join('')}${BRANCHES_KO.join('')}](?:${RELATION_KIND}))${GANZHI_TAIL}`,
  'gu'
);
const RELATION_CLAIM_RE = new RegExp(
  `(?<![가-힣])(?:천간|지지|일지|월지|년지|시지|일주|월주|년주|시주)?\\s?` +
  `(${RELATION_KIND})(?:하고|한|합|해|을 이루|이 걸|이 있|이 되|을 만들|이 성립)`,
  'gu'
);

const YEAR_RE = /(?<![0-9])((?:19|20)\d{2})(?![0-9])/gu;
const MONTH_RE = /(?<![0-9])(\d{1,2})월/gu;
const PERCENT_RE = /(?<![0-9])(\d+(?:\.\d+)?)\s*%/gu;
/** `점검` 만 제외한다. 조사(`87점으로`, `87점입니다`)는 그대로 받아야 한다. */
const SCORE_RE = /(?<![0-9])(\d+(?:\.\d+)?)\s*점(?!검)/gu;
/**
 * 집합 구축용. **정량 필드의 값만** 받는다.
 *
 * JSON 안의 모든 수치 리터럴을 받으면(타임스탬프·인덱스·ID 조각까지) 허용 집합이
 * 사실상 모든 두세 자리 숫자로 불어나 퍼센트·점수 검사가 무력해진다. 그래서
 * 정량으로 읽히는 키의 값과, 산문에서 이미 `%`·`점` 으로 쓰인 숫자만 받는다.
 */
const QUANTITATIVE_FIELD_RE =
  /"[A-Za-z_]*(?:score|percent|ratio|value|count|total|passed|weight|confidence)[A-Za-z_]*"\s*:\s*(-?\d+(?:\.\d+)?)/giu;

function normalizeNumber(raw: string): string {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? String(parsed) : raw;
}

function collect(re: RegExp, text: string, onMatch: (value: string) => void) {
  const pattern = new RegExp(re.source, re.flags);
  let match = pattern.exec(text);
  while (match !== null) {
    onMatch(match[1] ?? match[0]);
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
}

/**
 * 간지 정규식은 천간·지지를 **따로** 캡처한다(공백·혼용 허용의 대가다).
 * 캡처 그룹 중 비어 있지 않은 것을 순서대로 이어 붙여 한 쌍을 복원하고,
 * 항상 한글 표기로 정규화해 돌려준다. 집합에는 두 표기가 모두 들어 있으므로
 * 어느 쪽으로 정규화해도 되지만, 거부 메시지가 읽히려면 한 표기로 고정해야 한다.
 */
function collectGanzhiPairs(re: RegExp, text: string, onMatch: (value: string) => void) {
  const pattern = new RegExp(re.source, re.flags);
  let match = pattern.exec(text);
  while (match !== null) {
    const parts = match.slice(1).filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length >= 2) {
      const [stem, branch] = parts;
      onMatch(`${HANJA_TO_KO[stem] || stem}${HANJA_TO_KO[branch] || branch}`);
    } else if (parts.length === 1) {
      onMatch(parts[0]);
    }
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
}

/**
 * 십성 집합은 **정량 표의 라벨을 그대로 받지 않는다.**
 *
 * `report.tenGods` 는 값이 0 인 십성까지 `{label:'편관', value:0}` 으로 싣기 때문에,
 * JSON 을 통째 훑으면 십성 10개가 전부 집합에 들어와 검사가 완전한 no-op 이 된다
 * (실측: `universe.tenGod` = 10/10). 그래서 두 출처만 받는다:
 *   - 값이 0 이 아닌 정량 항목의 라벨
 *   - **산문**(길이 8자 이상 문자열)에 실제로 등장한 십성
 * 라벨 필드는 2~3자이므로 산문 기준에 걸리지 않고, 결정론 문장이 0인 십성을
 * 정당하게 언급하는 경우는 그 문장 자체가 집합에 넣어 준다(오거부 없음).
 */
function collectTenGodUniverse(value: unknown, add: (label: string) => void, depth = 0) {
  if (depth > 12 || value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (value.length >= 8) collect(TEN_GOD_RE, value, add);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTenGodUniverse(item, add, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const label = record.label ?? record.name ?? record.key;
  const amount = record.value ?? record.count ?? record.score;
  if (typeof label === 'string' && typeof amount === 'number') {
    if (amount !== 0 && (TEN_GODS as readonly string[]).includes(label)) add(label);
    // 라벨/값 짝은 여기서 소비하고 아래 일반 순회에서 라벨을 다시 읽지 않는다.
    Object.entries(record).forEach(([key, child]) => {
      if (key === 'label' || key === 'name' || key === 'key') return;
      collectTenGodUniverse(child, add, depth + 1);
    });
    return;
  }

  Object.values(record).forEach((child) => collectTenGodUniverse(child, add, depth + 1));
}

/**
 * 결정론 계산에 **실재하는** 값 집합을 만든다.
 *
 * `deterministicBasis` 와 `baseReport` 를 통째로 직렬화해 관대한 추출기로 훑는다.
 * 통째 직렬화를 쓰는 이유는 명세가 지정한 방식이기도 하고, 계산값이 어느 필드에
 * 실려 나가든(문자열 산문이든 숫자 필드든) 빠짐없이 잡히기 때문이다.
 */
export function buildEntityUniverse(
  basis: DeterministicSajuBasis | null | undefined,
  base: SajuReportData
): EntityUniverse {
  const ganzhi = new Set<string>();
  const tenGod = new Set<string>();
  const twelveStage = new Set<string>();
  const year = new Set<string>();
  const month = new Set<string>();
  const numbers = new Set<string>();
  const relation = new Set<string>();

  const sources = [basis ? JSON.stringify(basis) : '', JSON.stringify(base)];

  sources.forEach((text) => {
    if (!text) return;
    const addGanzhi = (value: string) => ganzhiVariants(value).forEach((form) => ganzhi.add(form));
    collect(GANZHI_HANJA_RE, text, addGanzhi);
    // `"ganzhi":"을사"` 처럼 값으로만 실린 형태와 `을사년 흐름` 처럼 산문에 녹은 형태를
    // 둘 다 집합에 넣는다. 한쪽만 걸면 실재하는 간지가 집합에서 빠져 오거부가 난다.
    collect(GANZHI_KO_BARE_RE, text, addGanzhi);
    collectGanzhiPairs(GANZHI_SUFFIXED_RE, text, addGanzhi);
    collectGanzhiPairs(GANZHI_MIXED_RE, text, addGanzhi);
    collect(TWELVE_STAGE_RE, text, (value) => twelveStage.add(value));
    collect(TWELVE_STAGE_IN_CONTEXT_RE, text, (value) => twelveStage.add(value));
    collect(TWELVE_STAGE_NEAR_PHASE_RE, text, (value) => twelveStage.add(value));
    collect(YEAR_RE, text, (value) => year.add(normalizeNumber(value)));
    collect(MONTH_RE, text, (value) => month.add(normalizeNumber(value)));
    // 월은 `"month":3` 처럼 숫자 필드로만 존재하는 경우가 흔하다.
    collect(/"month"\s*:\s*(\d{1,2})/gu, text, (value) => month.add(normalizeNumber(value)));
    collect(/\d{4}-(\d{2})-\d{2}/gu, text, (value) => month.add(normalizeNumber(value)));
    collect(QUANTITATIVE_FIELD_RE, text, (value) => numbers.add(normalizeNumber(value)));
    collect(PERCENT_RE, text, (value) => numbers.add(normalizeNumber(value)));
    collect(SCORE_RE, text, (value) => numbers.add(normalizeNumber(value)));
    collect(RELATION_LABEL_RE, text, (value) => relation.add(value));
    collect(RELATION_CLAIM_RE, text, (value) => relation.add(value));
    // `"subtype":"자축합"` · `"name":"지지육합"` 은 라벨 정규식이 이미 잡지만,
    // 관계 **종류**만 남은 서술(`'합·삼합·방합은 …'`)도 집합에 넣어야
    // 실재하는 관계 종류를 서술한 문장이 오거부되지 않는다.
    collect(new RegExp(`(?<![가-힣])(${RELATION_KIND})(?![가-힣])`, 'gu'), text, (value) => relation.add(value));
  });

  // 십성은 통짜 JSON 이 아니라 객체 트리를 직접 훑는다(위 `collectTenGodUniverse` 주석).
  collectTenGodUniverse(base, (label) => tenGod.add(label));
  if (basis) collectTenGodUniverse(basis, (label) => tenGod.add(label));

  return { ganzhi, tenGod, twelveStage, year, month, number: numbers, relation };
}

export interface UnknownEntity {
  kind: EntityKind;
  token: string;
}

/**
 * 모델 문장에서 뽑은 값 중 실재 집합 밖의 것을 돌려준다.
 * 하나라도 있으면 호출자는 **그 필드만** 거부한다.
 */
export function findUnknownEntities(text: string, universe: EntityUniverse): UnknownEntity[] {
  if (!text) return [];
  const unknown: UnknownEntity[] = [];
  const seen = new Set<string>();
  const push = (kind: EntityKind, token: string, allowed: ReadonlySet<string>) => {
    if (allowed.has(token)) return;
    const key = `${kind}:${token}`;
    if (seen.has(key)) return;
    seen.add(key);
    unknown.push({ kind, token });
  };

  const pushGanzhi = (value: string) => push('ganzhi', value, universe.ganzhi);
  collect(GANZHI_HANJA_RE, text, (value) => pushGanzhi(
    [...value].map((char) => HANJA_TO_KO[char] || char).join('')
  ));
  collectGanzhiPairs(GANZHI_SUFFIXED_RE, text, pushGanzhi);
  collectGanzhiPairs(GANZHI_MIXED_RE, text, pushGanzhi);
  collectGanzhiPairs(GANZHI_TRAILING_CONTEXT_RE, text, pushGanzhi);
  collectGanzhiPairs(GANZHI_LEADING_CONTEXT_RE, text, pushGanzhi);
  collect(TEN_GOD_RE, text, (value) => push('tenGod', value, universe.tenGod));
  collect(TWELVE_STAGE_RE, text, (value) => push('twelveStage', value, universe.twelveStage));
  collect(TWELVE_STAGE_IN_CONTEXT_RE, text, (value) => push('twelveStage', value, universe.twelveStage));
  collect(TWELVE_STAGE_NEAR_PHASE_RE, text, (value) => push('twelveStage', value, universe.twelveStage));
  collect(YEAR_RE, text, (value) => push('year', normalizeNumber(value), universe.year));
  collect(MONTH_RE, text, (value) => push('month', normalizeNumber(value), universe.month));
  collect(PERCENT_RE, text, (value) => push('percent', normalizeNumber(value), universe.number));
  collect(SCORE_RE, text, (value) => push('score', normalizeNumber(value), universe.number));
  collect(RELATION_LABEL_RE, text, (value) => push('relation', value, universe.relation));
  collect(RELATION_CLAIM_RE, text, (value) => push('relation', value, universe.relation));

  return unknown;
}

/* ------------------------------------------------------------------ *
 * ②-b 귀속 검사 — 집합 소속이 아니라 '어느 값이 어디에 붙는가'
 * ------------------------------------------------------------------ */

/**
 * 화이트리스트는 **값의 집합 소속만** 본다. 그래서 잠금된 계산값과 정면으로 모순되는
 * 문장이 통과한다 — 실측: 일주 `무자` 인데 `'일주는 임자로 읽었습니다'`(임자는 대운표에
 * 있어 집합 통과), 일간 `무` 인데 `'일간 병화는'`, 도움 오행 `토·화` 인데
 * `'도움 오행은 수와 금이라'`, 오행 목=0 인데 `'목 기운이 가장 강하고'`.
 * 같은 리포트가 `expert-evidence-v2` 에 잠긴 `'무자일주'` 와 `'일주는 임자'` 를 동시에 싣는다.
 *
 * 완전한 해결은 명세 §4-3 의 `claimRefs`(위치 결속)지만, 그 전에도 **귀속 서술어가 붙은
 * 문장**만은 국지적으로 잡을 수 있다. 귀속 서술어는 종류가 적고 형태가 고정적이다:
 * `일간` · `일주/월주/년주/시주` · `도움 오행/용신/희신` · `가장 강한/약한` · 십성 강약.
 *
 * 이 검사는 **찾은 귀속 주장만** 본다. 귀속 서술어가 없는 문장은 대상이 아니다
 * (그쪽은 claim ledger 가 들어와야 막힌다 — 남은 구멍임을 ADR 에 적는다).
 */
export interface ReportFactAnchors {
  dayMasterStem: string;
  dayMasterElement: string;
  pillars: Readonly<Record<'year' | 'month' | 'day' | 'hour', string | null>>;
  helpfulElements: ReadonlySet<string>;
  tenGodValues: ReadonlyMap<string, number>;
  strongestElements: ReadonlySet<string>;
  weakestElements: ReadonlySet<string>;
  /** 용신이 '확정' 이 아니면 단정형 용신 주장 자체를 거부한다. */
  yongsinConfirmed: boolean;
}

const ELEMENTS = ['목', '화', '토', '금', '수'] as const;

/** `무자` / `戊子` 를 한글 표기로 정규화한다. 표기 차이로 오거부가 나지 않게 한다. */
function normalizeGanzhiKo(value: string | null | undefined): string | null {
  if (!value) return null;
  const chars = [...value.trim()].filter((char) => KO_TO_HANJA[char] || HANJA_TO_KO[char]);
  if (chars.length < 2) return null;
  return chars.slice(0, 2).map((char) => HANJA_TO_KO[char] || char).join('');
}

export function buildReportFactAnchors(
  basis: DeterministicSajuBasis | null | undefined,
  base: SajuReportData
): ReportFactAnchors {
  const tenGodValues = new Map<string, number>();
  base.tenGods.forEach((item) => {
    if (typeof item?.label === 'string' && typeof item.value === 'number') {
      tenGodValues.set(item.label, item.value);
    }
  });

  const elementValues = base.fiveElements.filter((item) => typeof item?.value === 'number');
  const max = elementValues.reduce((best, item) => Math.max(best, item.value), Number.NEGATIVE_INFINITY);
  const min = elementValues.reduce((best, item) => Math.min(best, item.value), Number.POSITIVE_INFINITY);

  return {
    dayMasterStem: normalizeGanzhiKo(`${base.dayMaster}자`)?.[0] || base.dayMaster.trim().slice(0, 1),
    dayMasterElement: base.dayMasterElement,
    pillars: Object.freeze({
      year: normalizeGanzhiKo(base.pillars.year),
      month: normalizeGanzhiKo(base.pillars.month),
      day: normalizeGanzhiKo(base.pillars.day),
      hour: normalizeGanzhiKo(base.pillars.hour)
    }),
    helpfulElements: new Set(base.helpfulElements),
    tenGodValues,
    strongestElements: new Set(elementValues.filter((item) => item.value === max).map((item) => item.label)),
    weakestElements: new Set(elementValues.filter((item) => item.value === min).map((item) => item.label)),
    yongsinConfirmed: basis?.commercialV2?.interpretation
      ? basis.commercialV2.interpretation.consensus.value.decisionStatus === 'confirmed'
      : false
  };
}

export interface MisattributedClaim {
  /** 무엇을 잘못 붙였는지. 거부 메시지에 고객 문장을 싣지 않기 위해 라벨만 쓴다. */
  subject: string;
  claimed: string;
  actual: string;
}

const PILLAR_KEYS: ReadonlyArray<readonly [string, 'year' | 'month' | 'day' | 'hour']> = Object.freeze([
  ['년주', 'year'], ['연주', 'year'], ['월주', 'month'], ['일주', 'day'], ['시주', 'hour']
]);

const STEM_RE_SOURCE = `[${STEMS_KO.join('')}${STEMS_HANJA.join('')}]`;
const BRANCH_RE_SOURCE = `[${BRANCHES_KO.join('')}${BRANCHES_HANJA.join('')}]`;

export function findMisattributedClaims(text: string, anchors: ReportFactAnchors): MisattributedClaim[] {
  if (!text) return [];
  const out: MisattributedClaim[] = [];
  const add = (subject: string, claimed: string, actual: string) => {
    if (!out.some((item) => item.subject === subject && item.claimed === claimed)) {
      out.push({ subject, claimed, actual });
    }
  };

  /* 일간 — `일간 병화는` / `일간은 무토이고`. 천간 뒤에 오행·조사가 붙는 형태만 본다. */
  const dayStemPattern = new RegExp(
    `일간(?:은|는|이|가|의)?\\s*(${STEM_RE_SOURCE})(?=[${ELEMENTS.join('')}]|[은는이가의도로]|\\s|$|[,.·])`,
    'gu'
  );
  collect(dayStemPattern, text, (claimed) => {
    const ko = HANJA_TO_KO[claimed] || claimed;
    if (ko !== anchors.dayMasterStem) add('일간', ko, anchors.dayMasterStem);
  });

  /* 사주 기둥 — `일주는 임자로` 와 `임자 일주` 두 어순을 모두 본다. */
  PILLAR_KEYS.forEach(([label, key]) => {
    const actual = anchors.pillars[key];
    if (!actual) return;
    /*
     * 후행 조건에 `(?![가-힣])` 를 쓰면 안 된다. 한국어는 명사 뒤에 조사가 붙으므로
     * `'일주는 임자로 읽었습니다'` 가 검출되지 않는다(실측으로 걸렸던 지점 —
     * 어순만 바꾼 `'임자 일주로 봅니다'` 는 잡히는데 이쪽은 통과했다).
     */
    const forward = new RegExp(
      `${label}(?:은|는|이|가|의)?\\s*(${STEM_RE_SOURCE})\\s?(${BRANCH_RE_SOURCE})${GANZHI_TAIL}`,
      'gu'
    );
    const backward = new RegExp(
      `(?<![가-힣])(${STEM_RE_SOURCE})\\s?(${BRANCH_RE_SOURCE})\\s?${label}`,
      'gu'
    );
    [forward, backward].forEach((pattern) => {
      collectGanzhiPairs(pattern, text, (claimed) => {
        if (claimed !== actual) add(label, claimed, actual);
      });
    });
  });

  /*
   * 도움 오행 · 용신 · 희신.
   * 한 문장에 여러 오행이 오는 형태(`수와 금이라`)를 받기 위해 절 끝까지 훑어
   * 오행 글자를 전부 모은다.
   */
  const helpfulPattern = /(?:도움\s*오행|용신|희신)(?:은|는|이|가|으로|로)?\s*([^.!?\n]{0,24})/gu;
  collect(helpfulPattern, text, (clause) => {
    const claimedElements = [...new Set([...clause].filter((char) => (ELEMENTS as readonly string[]).includes(char)))];
    claimedElements.forEach((element) => {
      if (!anchors.helpfulElements.has(element)) {
        add('도움 오행', element, [...anchors.helpfulElements].join('·') || '없음');
      }
    });
  });

  /*
   * 용신 단정. `commercialV2.interpretation.consensus` 가 `confirmed` 가 아니면
   * 후보를 확정 용신으로 말할 수 없다(`PREMIUM_SAJU_FACT_CONSTRAINTS` 의 같은 규칙).
   * 프롬프트에만 있고 집행이 없던 규칙이다.
   */
  if (!anchors.yongsinConfirmed && /용신(?:은|는|이|가)\s*[목화토금수]/u.test(text)) {
    add('용신', '확정 단정', '미확정 합의');
  }

  /* 오행 극값 — `목 기운이 가장 강하고` / `화 기운이 가장 약합니다`. */
  const extremum = /([목화토금수])\s*(?:기운|오행)?(?:이|가|은|는)?\s*(?:[^.!?\n]{0,10}?)가장\s*(강|약|많|적)/gu;
  const extremumPattern = new RegExp(extremum.source, extremum.flags);
  let extremumMatch = extremumPattern.exec(text);
  while (extremumMatch !== null) {
    const element = extremumMatch[1];
    const direction = extremumMatch[2];
    const strong = direction === '강' || direction === '많';
    const allowed = strong ? anchors.strongestElements : anchors.weakestElements;
    if (!allowed.has(element)) {
      add(
        strong ? '가장 강한 오행' : '가장 약한 오행',
        element,
        [...allowed].join('·') || '없음'
      );
    }
    if (extremumMatch.index === extremumPattern.lastIndex) extremumPattern.lastIndex += 1;
    extremumMatch = extremumPattern.exec(text);
  }

  /*
   * 십성 강약. 집합 소속 검사만으로는 `'편관이 매우 강해'`(편관 = 0)를 못 막는다 —
   * 결정론 문장이 0인 십성을 언급하는 순간 집합에 들어오기 때문이다.
   * 값이 0 인데 강하다고 하거나, 값이 있는데 없다고 하면 거부한다.
   */
  const strengthPattern = new RegExp(
    `(${TEN_GODS.join('|')})(?:이|가|은|는)\\s*(?:[^.!?\\n]{0,8}?)(매우\\s*강|아주\\s*강|강하|많|발달|두드러|전혀\\s*없|하나도\\s*없|없)`,
    'gu'
  );
  const tenGodPattern = new RegExp(strengthPattern.source, strengthPattern.flags);
  let tenGodMatch = tenGodPattern.exec(text);
  while (tenGodMatch !== null) {
    const label = tenGodMatch[1];
    const claim = tenGodMatch[2];
    const value = anchors.tenGodValues.get(label);
    if (typeof value === 'number') {
      const claimsAbsent = claim.includes('없');
      if (claimsAbsent && value > 0) add(`십성 ${label}`, '없다', `${value}`);
      if (!claimsAbsent && value === 0) add(`십성 ${label}`, '강하다', '0');
    }
    if (tenGodMatch.index === tenGodPattern.lastIndex) tenGodPattern.lastIndex += 1;
    tenGodMatch = tenGodPattern.exec(text);
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * ③ 금지 표현 선검사
 * ------------------------------------------------------------------ */

/**
 * base 차감을 **허용하는** 금지어 규칙.
 *
 * 차감이 필요한 이유는 규칙이 결정론 카피를 정당하게 트립하기 때문이다:
 *   - `probability` 의 `/\d+%/` 는 오행 분포(`목 0%`)를 막는다
 *   - `age-mention` 의 `/\d+세/` 는 대운 구간(`30세 ~ 39세`)을 막는다
 * 이 둘만 차감 대상이고, **나머지는 전부 절대 검사다.**
 *
 * 처음 구현은 전 규칙을 차감 대상으로 뒀는데, 그 결과 base 가 어떤 라벨을 한 번
 * 트립하면 그 필드에서 해당 규칙이 조용히 꺼졌다. 하드 가드 7종은 라벨 단위 차감이라
 * 특히 거칠었다 — base 가 `'상대 속마음 단정'` 을 한 번 트립하면 그 필드에서
 * 상대 속마음 검사 전체가 면제됐다.
 */
export const SUBTRACTABLE_BANNED_RULE_IDS: ReadonlySet<string> = new Set([
  'probability',
  'age-mention',
  /*
   * `upsell` 의 `개운` 리터럴은 부적 판매를 겨냥한 것인데, 결정론 카피의 `개운법`
   * (행운 색·숫자·방향·루틴)까지 잡는다. 차감은 **조각 단위**(`ruleId:match`)이므로
   * base 가 `개운` 을 쓰는 필드에서 `개운` 만 면제되고 `부적`·`굿을`·`추가 상담` 은
   * 그 필드에서도 그대로 잡힌다.
   */
  'upsell'
]);

export interface TextGuardOptions {
  /** 밴드별 추가 금지어. 넘기지 않으면 공통 49개만 검사된다(그게 원래 버그였다). */
  band?: ReunionAgeBand | null;
  /** 차단·거절·학대 신호 상태. 의도 가드의 추가 규칙을 켠다. */
  intent?: ReunionIntentContext | null;
}

/**
 * **절대 검사** 라벨. base 차감을 하지 않는다.
 *
 * 재회 하드 가드 7종 + 의도 가드 8종 + 차감 예외가 아닌 금지어 규칙.
 * base 가 이 패턴을 트립하면 그것은 모델 문제가 아니라 결정론 카피 버그이므로
 * 면제가 아니라 별도 테스트(`reunionIntentGuard.baseline.test.ts`)로 잡아야 한다.
 */
function absoluteViolationLabels(
  text: string,
  serviceId: SajuReportData['serviceId'],
  options: TextGuardOptions
): string[] {
  if (!text || serviceId !== 'love-reunion') return [];
  const labels = [...findLoveReunionSafetyTextViolations(text)];
  labels.push(...reunionIntentLabels(text, options.intent));
  findReunionBannedPhrases(text, options.band || undefined).forEach((hit) => {
    if (!SUBTRACTABLE_BANNED_RULE_IDS.has(hit.ruleId)) labels.push(hit.ruleId);
  });
  return labels;
}

/** base 차감을 적용하는 라벨. 오탐이 구조적으로 불가피한 규칙만 남아 있다. */
function subtractableViolationLabels(
  text: string,
  serviceId: SajuReportData['serviceId'],
  options: TextGuardOptions
): string[] {
  if (!text) return [];
  const labels = [...findCustomerTextPatternViolations(text)];
  if (serviceId === 'love-reunion') {
    findReunionBannedPhrases(text, options.band || undefined).forEach((hit) => {
      if (SUBTRACTABLE_BANNED_RULE_IDS.has(hit.ruleId)) labels.push(`${hit.ruleId}:${hit.match}`);
    });
  }
  return labels;
}

/**
 * 모델 문장의 금지 표현 위반 목록.
 *
 * 절대 검사분은 그대로 싣고, 차감 대상분은 base 에 없던 라벨만 싣는다.
 * 후보가 base 와 바이트 단위로 같으면(정상 echo) 검사를 건너뛴다 —
 * 내용이 결정론과 동일한데 거부하면 채택률만 깎인다.
 */
export function findNewTextViolations(
  candidate: string,
  expected: string | undefined,
  serviceId: SajuReportData['serviceId'],
  options: TextGuardOptions = {}
): string[] {
  if (!candidate) return [];
  if (expected !== undefined && candidate.trim() === expected.trim()) return [];

  const labels = absoluteViolationLabels(candidate, serviceId, options);
  const candidateSoft = subtractableViolationLabels(candidate, serviceId, options);
  if (candidateSoft.length > 0) {
    const baseSoft = new Set(subtractableViolationLabels(expected || '', serviceId, options));
    labels.push(...candidateSoft.filter((label) => !baseSoft.has(label)));
  }
  return [...new Set(labels)];
}

/* ------------------------------------------------------------------ *
 * (d) 영구 잠금 구간 — 명세 §4-6
 * ------------------------------------------------------------------ */

/**
 * 삭제 불가 문구 조각. `{name}` 슬롯이 있는 문구는 슬롯을 기준으로 쪼개
 * **모든 조각이 남아 있어야** 보존된 것으로 본다(이름은 고객마다 다르다).
 */
const UNDELETABLE_FRAGMENTS: ReadonlyArray<readonly string[]> = Object.freeze(
  [
    ...Object.values(REUNION_UNDELETABLE_COPY),
    /*
     * 재회운 heroNote — 리포트 최상단의 **유일한 경계 선언**이다.
     * `applyLoveReunionSafetyContract`(`reportBuilder.ts:118`)가 고정하는 문장인데
     * 영구 잠금 목록에 없어서 `heroNote: draft.heroNote || base.heroNote` 가 모델 값으로
     * 덮고, `lockCommercialReportFacts` 의 복원 목록에도 없었다(legalNotice 는 있었다).
     * 화면까지 도달한다 — `Report.tsx` 가 `{report.heroNote}` 를 그대로 렌더한다.
     * 여기 넣으면 authored 모드에서도 바이트 일치를 요구하고,
     * `reportFactGuard.lockCommercialReportFacts` 가 2차로 base 값을 복원한다.
     */
    LOVE_REUNION_HERO_NOTE
  ]
    .flatMap((value) => value.split('\n'))
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .map((line) => line.split(/\{name\}/gu).map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length > 0)
);

function containsFragment(text: string, parts: readonly string[]): boolean {
  return parts.every((part) => text.includes(part));
}

/**
 * 이 문구가 **영구 잠금 구간**인가.
 *
 * 삭제 불가 문구 7개와 법정 고지가 들어 있는 필드는 3단 검증이 아니라
 * 기존의 엄격한 일치를 그대로 유지한다. 모델은 이 문장들을 손댈 수 없다.
 */
export function isPermanentlyLockedProse(expected: string | undefined): boolean {
  if (!expected) return false;
  return UNDELETABLE_FRAGMENTS.some((parts) => containsFragment(expected, parts));
}

/** base 에 있던 삭제 불가 문구가 모델 문장에서 사라졌는지. */
export function findRemovedUndeletableCopy(
  candidate: string,
  expected: string | undefined
): string[] {
  if (!expected) return [];
  return UNDELETABLE_FRAGMENTS
    .filter((parts) => containsFragment(expected, parts) && !containsFragment(candidate, parts))
    .map((parts) => parts.join(' … '));
}

/* ------------------------------------------------------------------ *
 * 병합 후 2차 방어
 * ------------------------------------------------------------------ */

/** 고객에게 실제로 보이는 산문 필드만 평평하게 훑는다. engineMeta·qualityAudit 은 제외한다. */
export function customerProseFields(report: SajuReportData): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) out.push({ path, text: value });
  };

  push('heroNote', report.heroNote);
  push('summary.title', report.summary?.title);
  report.summary?.analysis?.forEach((value, index) => push(`summary.analysis.${index}`, value));
  report.summary?.advice?.forEach((value, index) => push(`summary.advice.${index}`, value));
  report.keyTakeaways?.forEach((card, index) => {
    push(`keyTakeaways.${index}.body`, card.body);
    push(`keyTakeaways.${index}.badge`, card.badge);
  });
  report.questionAnswers?.forEach((answer, index) => {
    push(`questionAnswers.${index}.title`, answer.title);
    push(`questionAnswers.${index}.analysis`, answer.analysis);
    answer.advice?.forEach((value, adviceIndex) =>
      push(`questionAnswers.${index}.advice.${adviceIndex}`, value)
    );
  });
  report.sections?.forEach((section) => {
    section.paragraphs?.forEach((value, index) => push(`sections.${section.id}.paragraphs.${index}`, value));
    section.bullets?.forEach((value, index) => push(`sections.${section.id}.bullets.${index}`, value));
    push(`sections.${section.id}.callout.title`, section.callout?.title);
    push(`sections.${section.id}.callout.body`, section.callout?.body);
    section.cards?.forEach((card, index) => {
      push(`sections.${section.id}.cards.${index}.body`, card.body);
      push(`sections.${section.id}.cards.${index}.badge`, card.badge);
    });
    section.details?.forEach((detail, index) =>
      push(`sections.${section.id}.details.${index}.content`, detail.content)
    );
  });
  (['currentDayun', 'nextDayun'] as const).forEach((key) => {
    push(`${key}.summary`, report[key]?.summary);
    push(`${key}.focus`, report[key]?.focus);
    push(`${key}.caution`, report[key]?.caution);
  });
  push('actionPlan.title', report.actionPlan?.title);
  report.actionPlan?.priorities?.forEach((value, index) => push(`actionPlan.priorities.${index}`, value));
  report.actionPlan?.dos?.forEach((value, index) => push(`actionPlan.dos.${index}`, value));
  report.actionPlan?.avoids?.forEach((value, index) => push(`actionPlan.avoids.${index}`, value));
  report.actionPlan?.luckyDays?.forEach((day, index) => push(`actionPlan.luckyDays.${index}.reason`, day.reason));
  report.actionPlan?.unluckyDays?.forEach((day, index) => push(`actionPlan.unluckyDays.${index}.reason`, day.reason));

  report.reunion?.chapters?.forEach((chapter) => {
    chapter.cuts?.forEach((cut) => {
      push(`reunion.${cut.id}.narration`, cut.narration);
      push(`reunion.${cut.id}.caption`, cut.caption);
      cut.bubbles?.forEach((bubble, index) => push(`reunion.${cut.id}.bubbles.${index}`, bubble.text));
    });
  });

  return out;
}

export interface ReunionProseSafetyFinding {
  path: string;
  labels: string[];
}

/**
 * 병합된 리포트에 대한 **2차 방어**.
 *
 * draft 선검사(`findNewTextViolations`)와 별개로 한 번 더 돌린다. 이유는 병합·lock·
 * `finalizeCustomerReport` 를 거치는 동안 문장이 재조립되기 때문이고, 더 중요하게는
 * 기존 병합 후 검사(`assertLoveReunionReportSafety`)가 draft 선검사와 **같은 표**를 써서
 * 순증 방어가 0 이었기 때문이다.
 *
 * base 대비 **새로 생긴** 위반만 돌려준다. 결정론 카피 자체의 위반은 프로덕션에서
 * fallback 을 유발하는 대신 `reunionIntentGuard.baseline.test.ts` 가 잡는다 —
 * 카피 버그를 500 으로 배우면 안 된다.
 */
export function findNewReunionProseSafetyFindings(
  base: SajuReportData,
  candidate: SajuReportData,
  options: TextGuardOptions = {}
): ReunionProseSafetyFinding[] {
  if (candidate.serviceId !== 'love-reunion') return [];

  const baseByPath = new Map(customerProseFields(base).map((field) => [field.path, field.text]));
  const findings: ReunionProseSafetyFinding[] = [];

  customerProseFields(candidate).forEach(({ path, text }) => {
    const expected = baseByPath.get(path);
    const labels = findNewTextViolations(text, expected, candidate.serviceId, options);
    if (labels.length > 0) findings.push({ path, labels });
  });

  return findings;
}

export { isContactWithheld };
export type { ReunionIntentContext };
