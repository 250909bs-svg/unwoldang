/**
 * 재회운 · 의도 단위 안전 판정.
 *
 * ## 왜 새 파일인가
 *
 * 기존 검사표 세 개(`LOVE_REUNION_SAFETY_CHECKS` 7개 · `CUSTOMER_FORBIDDEN_PATTERNS` ·
 * `REUNION_COMMON_BANNED_RULES` 12개)는 전부 **좁은 리터럴**에 묶여 있다.
 * `'재회 가능성은 높습니다'` 는 잡지만 `'재회 가능성은 거의 확실합니다'` 는 통과하고,
 * `'SNS 스토리'` 는 잡지만 `'그 사람이 자주 가던 카페에 같은 시간에 가 보시면'` 은 통과한다.
 * 모델이 authored 모드에서 실제로 쓰는 문장은 정확히 그 패러프레이즈다.
 *
 * 그래서 리터럴이 아니라 **의도**로 판정한다. 아홉 축이 축마다 하나의 형태소·구문
 * 패턴군을 갖는다. 앞의 다섯 축은 검증에서 실제로 뚫린 범주다:
 *
 *   1. `contact-solicitation`  접촉 권유 — "연락해 보세요" 계열 (권유 어미 + 접촉 동사)
 *   2. `third-party-route`     제3자 경유·우회 연락 — 공통 지인, 다른 번호, 새 계정
 *   3. `physical-encounter`    물리적 마주침 — 집 앞, 자주 가던 곳, 기다리면 마주칠
 *   4. `partner-interior`      상대 내면·미래 행동 단정 — 기다리고 있다, 놓지 못했다
 *   5. `unanchored-hope`       무근거 격려·결과 단정 — 거의 확실, 조금만 더 버티면
 *
 * 그리고 이번 해제가 새로 연 위험 네 축을 더한다:
 *
 *   6. `obsession`             집착·반복 접촉 조장 — 끝까지 붙잡, 하루에 한 번씩
 *   7. `banmal`               반말·2인칭 추궁 (어미 패턴. 리터럴 4개로는 못 잡는다)
 *   8. `age-agnostic-minimum` 연령 무관 최소선 — 성적 조언, 음주, 가출·학업 이탈 유도
 *   9. `uncomputed-myeongri`  엔진이 계산하지 않는 신살·개념 (전량 금지)
 *
 * ## 설계 규칙 세 가지
 *
 * **(1) 절대 검사다. base 차감을 하지 않는다.**
 * 금지어 표의 base 차감(`findNewTextViolations`)은 `probability` 규칙처럼 결정론 카피가
 * 정당하게 트립하는 규칙 때문에 필요했다. 여기 아홉 축은 결정론 카피가 트립하면
 * **그게 카피 버그**이므로 면제하지 않는다. 대신 `reunionProseBaseline.test.ts` 가
 * 결정론 리포트 전체를 6개 밴드로 돌려 0건임을 잠근다 — 카피 버그는 프로덕션 500 이
 * 아니라 테스트 빨간불로 드러나야 한다.
 *
 * 예외는 두 축뿐이다: `partner-interior` 와 `unanchored-hope` 는 같은 문장에 메타 부인
 * 표현(`DISCLAIMER_MARKERS`)이 있으면 면제한다. 이 상품의 삭제 불가 문구가 정확히
 * "상대 속마음을 말하지 않겠다" 는 선언이기 때문이다.
 *
 * **(2) 완전 일치 echo 는 검사하지 않는다.**
 * 모델 문장이 base 와 바이트 단위로 같으면 새 위험이 아니다. 호출자가 그 경우를 걸러낸다.
 *
 * **(3) 차단·거절·학대 신호는 규칙을 더 세게 만든다.**
 * `contactStatus` 가 `blocked`/`unknown` 이거나 거절이 관찰됐거나 학대 신호가 있으면
 * `contact-solicitation` 은 물론 `'지금은 연락을 열어도 괜찮아요'` 처럼 권유 어미가 없는
 * 허용 서술까지 거부한다. 프롬프트 조항(`premiumReportPrompt.ts` 의 contactStatus 줄)은
 * 지금까지 집행 surface 가 아예 없었다.
 */

import type { ReunionContactStatus, ReunionContext } from '../reunion/types';
import { findReunionHarmSignals } from '../reunion/safetyCopy';

export type ReunionIntentCategory =
  | 'contact-solicitation'
  | 'third-party-route'
  | 'physical-encounter'
  | 'partner-interior'
  | 'unanchored-hope'
  | 'obsession'
  | 'banmal'
  | 'age-agnostic-minimum'
  | 'uncomputed-myeongri';

export interface ReunionIntentViolation {
  category: ReunionIntentCategory;
  /** 실제로 걸린 조각. 로그에는 싣지 않는다(고객 문장이다). */
  match: string;
  /** 왜 막는지. 테스트 실패 메시지에만 쓴다. */
  reason: string;
}

interface IntentRule {
  category: ReunionIntentCategory;
  reason: string;
  /** 전역 플래그 금지 — `lastIndex` 가 남아 같은 정규식 재사용 시 결과가 달라진다. */
  patterns: readonly RegExp[];
}

/** 한 문장 안에서만 본다. 문장 경계를 넘는 매칭은 오탐의 주된 원인이다. */
const SENTENCE_SPLIT = /(?<=[.!?\n])/u;

/** 상대를 가리키는 주어. 여러 규칙이 공유하므로 규칙표보다 먼저 선언한다. */
const PARTNER_SUBJECT = '그 사람|그분|상대방|상대|그쪽';

/**
 * 메타 부인 표현. 이 조각이 **같은 문장 안에** 있으면
 * `partner-interior` · `unanchored-hope` 두 축은 면제한다.
 *
 * 이 상품의 삭제 불가 문구가 정확히 이 형태다 —
 * `'재회 확률이나 상대의 속마음은 명리 계산으로 만들거나 확정하지 않습니다.'`
 * 상대 속마음을 **말하지 않겠다는 선언**을 상대 속마음 단정으로 잡으면
 * 안전 카피 자체가 거부된다.
 *
 * 목록을 좁게 유지하는 것이 핵심이다. `못`·`아니`처럼 흔한 부정어를 넣으면
 * `'아직 정리하지 못했어요'`(= 상대 속마음 단정)까지 면제돼 검사가 뒤집힌다.
 */
const DISCLAIMER_MARKERS: readonly RegExp[] = Object.freeze([
  /확정하지\s*않/u,
  /만들거나\s*확정/u,
  /예측한\s*값이\s*아/u,
  /보장하지\s*않/u,
  /판단하지\s*않/u,
  /단정하지\s*않/u,
  /말씀드리지\s*않/u,
  /쓰지\s*않/u,
  /지어내지\s*않/u,
  /알 수 없|볼 수 없|볼 수는 없/u
]);

const EXEMPTABLE_CATEGORIES: ReadonlySet<ReunionIntentCategory> = new Set([
  'partner-interior',
  'unanchored-hope'
]);

function hasDisclaimer(sentence: string): boolean {
  return DISCLAIMER_MARKERS.some((pattern) => pattern.test(sentence));
}

/* ------------------------------------------------------------------ *
 * 1. 접촉 권유
 * ------------------------------------------------------------------ */

/**
 * 접촉 동사구. `연락` 이라는 단어 자체는 base 카피에 정당하게 무수히 나온다
 * (`'연락 상태를 아직 확인하지 못했어요'`). 그래서 **권유 어미와 짝지어야만** 잡는다.
 */
const CONTACT_TARGET =
  '연락|메시지|문자|전화|카톡|카카오톡|디엠|안부|말을 걸|말을 붙|문을 두드|답장을 보내|먼저 다가|편지를 보내|톡을 보내|한 통 보내|연락을 열|대화를 열';

/**
 * 권유·허용 어미. 한국어에서 '해도 되는 일' 을 말하는 형태는 한정적이다.
 * `보세요` 계열(시도 권유) · `해도 괜찮/돼/됩니다` 계열(허용) ·
 * `하시면 좋/나아요` 계열(비교 권유) · `추천/권` 계열(명시 권유).
 */
const SOLICIT_TAIL =
  '보세요|보셔요|보셔도|보셔도 돼|봐도 되|보시는 것도|보시면|보는 편이|보는 게|보는 것도|' +
  '해 보|해보|해도 괜찮|해도 돼|해도 된|해도 됩니|하셔도 괜찮|하셔도 돼|하셔도 된|' +
  '하시면 좋|하시면 나|하는 편이 나|하는 게 좋|하시길|하시라|추천|권해|권하|권합니|' +
  '전해 보|전해도|시도해|열어도|열어 보|먼저 하셔|먼저 보내|하나만';

const CONTACT_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'contact-solicitation',
    reason: '접촉을 권유한다. 재회운에서 연락 여부는 리포트가 정하지 않는다.',
    patterns: [
      new RegExp(`(?:${CONTACT_TARGET})[^.!?\\n]{0,22}(?:${SOLICIT_TAIL})`, 'u'),
      /(?:먼저|이번에)[^.!?\n]{0,12}(?:연락|메시지|문자|전화|톡)[^.!?\n]{0,12}(?:해|보내|넣)/u,
      /(?:짧은|가벼운|간단한)\s*(?:안부|인사|연락|메시지)/u
    ]
  },
  {
    category: 'third-party-route',
    reason: '제3자 경유·우회 연락. 상대의 동의 경계를 우회하는 경로를 만들어 주지 않는다.',
    patterns: [
      /(?:공통|공통된|같은|서로 아는|주변|주위)\s*(?:친구|지인|사람)[^.!?\n]{0,24}(?:통해|통한|부탁|전해|물어|알아)/u,
      /(?:다른|새|새로운|부|여분의)\s*(?:번호|계정|아이디|메일|주소|연락처)/u,
      /(?:차단|블락)[^.!?\n]{0,30}(?:풀리|풀릴|해제|우회|지나면|열리)/u,
      /(?:친구|지인|동생|언니|형|누나)[^.!?\n]{0,16}(?:시켜|통해서)[^.!?\n]{0,16}(?:연락|전해|물어)/u
    ]
  },
  {
    category: 'physical-encounter',
    reason: '물리적 마주침 설계. 스토킹으로 읽히는 조언은 어떤 명리 근거로도 정당화되지 않는다.',
    /*
     * 장소 명사만으로는 잡지 않는다. 결정론 love 카피에는 **새로운 인연**의 만남 경로로
     * `'직장 근처, 반복적으로 마주치는 안정적인 공간'` 이 정당하게 들어 있다
     * (`reportBuilder` 의 love 섹션). 그래서 장소는 반드시
     *   (a) 상대를 가리키는 주어와 같은 문장에 있거나
     *   (b) 대기·방문·접근 동사와 붙어 있을
     * 때만 위반으로 본다. 오탐을 남기면 정상 필드가 조용히 base 로 되돌아가고,
     * 그러면 이 검사가 있다는 사실 자체가 채택률을 깎기만 한다.
     */
    patterns: [
      new RegExp(`(?:${PARTNER_SUBJECT})[^.!?\\n]{0,26}(?:집|회사|학교|직장|가게|학원)\\s*(?:앞|근처|주변)`, 'u'),
      /(?:집|회사|학교|직장|가게|학원)\s*(?:앞|근처|주변)[^.!?\n]{0,18}(?:기다|서 있|찾아|가 보|가시|들러|들르)/u,
      /(?:자주 가|다니던|가던|들르던|출퇴근|등하교)[^.!?\n]{0,30}(?:가 보|가시면|기다|들러|들르)/u,
      /(?:마주치|마주칠|우연히\s*(?:만나|마주|보게))[^.!?\n]{0,16}(?:수 있|도록|려면|게 되|보세요|보시)/u,
      /(?:기다리(?:면|시면|고 있으면))[^.!?\n]{0,24}(?:전해|닿|열리|만나|오게|보게)/u,
      /찾아가/u
    ]
  }
]);

/* ------------------------------------------------------------------ *
 * 2. 상대 내면·미래 행동 단정
 * ------------------------------------------------------------------ */

const PARTNER_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'partner-interior',
    reason: '상대의 속마음·미래 행동 단정. CH02 전체가 이 제약을 상품화한 것이다.',
    patterns: [
      new RegExp(
        `(?:${PARTNER_SUBJECT})[^.!?\\n]{0,28}` +
          '(?:놓지 못|잊지 못|정리하지 못|정리 못|기다리|같은 마음|같은 자리|후회|미련|' +
          '그리워|보고 싶|마음이 남|마음에서 놓|생각하고 있|생각이 날|돌아옵|돌아올|' +
          '먼저 (?:연락|말을 걸|다가)|답장(?:을 보내|이 올)|사랑하고|아직 (?:좋아|마음))',
        'u'
      ),
      new RegExp(`(?:${PARTNER_SUBJECT})(?:은|는|이|가|도)\\s*[^.!?\\n]{0,24}(?:할 거예요|할 겁니다|알 거예요|느낄 거예요|올 거예요)`, 'u'),
      /(?:상대|그 사람)(?:의)?\s*(?:속마음|진심|본심|마음속)(?:은|는|을|이|가)/u
    ]
  }
]);

/* ------------------------------------------------------------------ *
 * 3. 무근거 격려 · 결과 단정
 * ------------------------------------------------------------------ */

/** 정도 부사. `높습니다` 만 막던 기존 표의 정확한 빈틈이다. */
const CERTAINTY_ADVERB = '거의|대부분|십중팔구|결국|틀림없이|반드시|분명|필연적으로|무조건|당연히|꼭';
const REUNION_OUTCOME =
  '확실|이어(?:져|지|집|질)|돌아(?:와|옵|올)|만나(?:게|요|실)|연락(?:이|은)?\\s*(?:올|와|옵)|' +
  '재회|회복(?:됩|될|돼)|열립|열릴|성공|잘 될|잘될';

const HOPE_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'unanchored-hope',
    reason: '결과 단정. 정도 부사를 바꿔 끼운 확률 단정은 수치 단정과 같은 약속이다.',
    patterns: [
      new RegExp(`(?:${CERTAINTY_ADVERB})[^.!?\\n]{0,22}(?:${REUNION_OUTCOME})`, 'u'),
      new RegExp(`(?:${REUNION_OUTCOME})[^.!?\\n]{0,14}(?:${CERTAINTY_ADVERB})`, 'u'),
      /*
       * 조건절 + 긍정 결과. 결과 쪽을 느슨하게 두면
       * `'같은 내용을 두 번째 보내면 다음 대화를 여는 조건이 되돌아갑니다'`
       * (결정론 금지행동 카피, 계량 서술)의 `되돌아` 가 `돌아` 로 잡힌다.
       * 결과는 반드시 **주어와 서술어 짝**으로 요구한다.
       */
      /(?:연락하면|보내면|만나면|기다리면|하시면|다가가면|표현하면)[^.!?\n]{0,20}(?:답장이\s*(?:옵|올|와)|연락이\s*(?:옵|올|와)|마음이\s*(?:전해|열려|돌아)|관계가\s*(?:회복|이어)|다시\s*(?:이어|만나)|열립니다|열려요|돌아옵|돌아올|풀립니다|풀려요)/u,
      /(?:운명|천생연분|인연이 정해|정해진 인연|필연)(?:이에요|입니다|이라|예요|이야|이니)/u,
      /(?:이 사람|그 사람|이 인연)[^.!?\n]{0,12}아니면 안/u
    ]
  },
  {
    category: 'unanchored-hope',
    reason: '근거 없는 대기·인내 격려. 이별 직후 독자에게 가장 비싼 실수다.',
    patterns: [
      /(?:조금만|좀|더|한 달만|며칠만)\s*(?:더\s*)?(?:기다리|버티|참으|견디)/u,
      /포기하지\s*(?:마|말|않)/u,
      /(?:희망을|기대를|가능성을)\s*(?:버리지|놓지)\s*(?:마|말|않)/u,
      /(?:여지|가능성)(?:가|이)?\s*(?:남아 있|충분|아직)/u
    ]
  }
]);

/* ------------------------------------------------------------------ *
 * 4. 집착 · 반복 접촉 조장
 * ------------------------------------------------------------------ */

const OBSESSION_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'obsession',
    reason: '집착·반복 접촉 조장. 관찰 가능한 계량 서술로만 쓴다.',
    patterns: [
      /(?:계속|또|한 번 더|다시 한 번|매일|하루에|매주|주에|자주)[^.!?\n]{0,14}(?:보내|연락|전화|문자|톡|두드|찾)/u,
      /(?:끝까지|포기하지 않고|될 때까지)[^.!?\n]{0,10}(?:붙잡|매달|기다|해 보)/u,
      /(?:붙잡|매달리|놓지 마|놓지 않아도|간직)[^.!?\n]{0,12}(?:되|돼|괜찮|좋|보세요)/u,
      /(?:답장이 없|답이 없|읽씹|무응답|읽고 답)[^.!?\n]{0,18}(?:계속|또|한 번 더|다시|보내)/u,
      /(?:마음을|생각을)\s*(?:계속|그대로)\s*(?:붙잡|간직|품)/u
    ]
  }
]);

/* ------------------------------------------------------------------ *
 * 5. 반말 · 2인칭 추궁
 * ------------------------------------------------------------------ */

/**
 * 어미 패턴으로 잡는다. 리터럴 4개(`했잖아` 등)로는 못 막는다.
 *
 * 존댓말 base 는 이 패턴을 절대 트립하지 않으므로 차감이 불필요하다.
 * 인용부호 안의 상대 발화는 base 에 존재하지 않으므로 예외를 두지 않는다.
 */
const BANMAL_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'banmal',
    reason: '반말·2인칭 추궁. 이별 직후 독자에게 2차 가해이고 운월 목소리 규격과 충돌한다.',
    patterns: [
      /*
       * `당신` 은 여기 넣지 않는다. 반말이 아니고, 결정론 love 카피가
       * `'당신의 영역을 존중하는 사람'` 처럼 정당하게 쓴다.
       * `LOVE_REUNION_VOICE_SPEC` 이 `당신` 을 금지하는 것은 **문체 규격**이며,
       * 어기면 필드가 버려지는 안전 규칙이 아니다. 둘을 섞으면 결정론 카피가
       * 자기 안전 검사에 걸린다.
       */
      /(?:^|[\s"'(])(?:너|넌|네가|니가|너는|너도|너를|너의)(?:[\s은는이가을를도의]|$)/u,
      /[가-힣](?:잖아|거야|더라|는데\?|니\?|냐\?|야\?)(?:[\s.!?]|$)/u,
      /[가-힣](?:했어|봤어|했지|이야|아니야|그래|맞지)(?:[\s.!?]|$)/u,
      /(?:하지 마라|하지 말아라|정신 차려|인정해(?:[\s.!?]|$))/u
    ]
  }
]);

/* ------------------------------------------------------------------ *
 * 6. 연령 무관 최소선
 * ------------------------------------------------------------------ */

/**
 * 결제 경로에 성인 확인이 없다. 그래서 **밴드 판정 실패 시에도 적용되는 공통 규칙**이다
 * (밴드별 금지어는 `findReunionBannedPhrases(text, band)` 가 따로 본다).
 */
const MINIMUM_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'age-agnostic-minimum',
    reason: '연령 무관 최소선. 독자 연령을 확인할 수단이 결제 경로에 없다.',
    patterns: [
      /(?:하룻밤|잠자리|성관계|몸부터|같이 자|자고 나면|스킨십부터|옷을 벗)/u,
      /* `술` 은 `기술`·`예술`·`미술`·`무술` 의 조각이다. 앞 글자가 한글이면 잡지 않는다. */
      /(?<![가-힣])(?:술|음주|한잔|술자리|맥주|소주|와인)[^.!?\n]{0,14}(?:하|드시|먹|마시|기울|한잔)/u,
      /(?:가출|집을 나|학교를 (?:그만|빠지)|자퇴|결석)/u,
      /(?:부모님|가족|선생님)[^.!?\n]{0,16}(?:속이|숨기|모르게)/u,
      /(?:몰래|들키지 않)/u
    ]
  }
]);

/* ------------------------------------------------------------------ *
 * 7. 계산하지 않는 명리 개념
 * ------------------------------------------------------------------ */

/**
 * 엔진이 **계산조차 하지 않는** 신살·관계 개념. 집합을 만들 근거가 없으므로
 * 화이트리스트가 아니라 전량 금지로 둔다(명세의 안전 원칙: 계산하지 않는 개념을
 * 모델이 말하게 둘 이유가 없다).
 *
 * 실제 계산되는 신살은 `detectShensha`(`baziCalcs.ts:272`)의 세 개뿐이다 —
 * 천을귀인 · 도화 · 괴강. 그 셋은 `geminiProseGuard` 의 엔티티 집합이 basis 에서
 * 뽑아 화이트리스트로 검사한다.
 */
export const UNCOMPUTED_MYEONGRI_TOKENS: readonly string[] = Object.freeze([
  /*
   * 여기 없는 것들 — 왜 뺐는지 남긴다. 실측으로 확인했다.
   *
   * `삼형` 은 **엔진이 실제로 계산한다** (`interactions/relations.ts:106-107`
   * `지지삼형`, 그리고 `지지형` 의 불확실성 문구가 `삼형의 완성 여부` 를 언급한다).
   * 결정론 리포트의 `temporal-evidence-v2` · `compatibility-evidence-v2` 가 이 단어를
   * 정당하게 쓴다. 전량 금지에 두면 결정론 근거 섹션 자체가 위반이 된다.
   * 합·충·형·파·해·원진은 basis 에서 집합을 만들 수 있으므로
   * `geminiProseGuard` 의 `relation` 화이트리스트가 담당한다.
   *
   * `유하`(유하다 = 부드럽다) · `역마`(역마살 없이도 흔한 단어) 는 일상어와 겹쳐
   * 결정론 카피를 오탐했다.
   */
  /*
   * `천간합`·`천간충` 도 여기 **없다.** 엔진이 실제로 계산한다
   * (`interactions/relations.ts:41-50` `stem-combination` / `stem-clash`,
   * 라벨은 `갑기합`·`을경합`·`갑경충` 형태). `temporal-evidence-v2` 가 이 단어를
   * 정당하게 쓴다 — 실측으로 확인했다. 지어낸 천간 관계는
   * `geminiProseGuard` 의 `relation` 화이트리스트가 **천간 쌍 라벨 단위**로 잡는다.
   */
  /*
   * `삼형살` 은 금지하고 `삼형` 은 금지하지 않는다.
   *
   * 엔진은 `지지삼형` 을 관계로 계산하고(`relations.ts:106-107`), 결정론 근거 섹션이
   * `'삼형의 완성 여부'` 를 정당하게 쓴다. 반면 `살` 접미사를 붙인 `삼형살` 은
   * 계산되지 않는 신살 어휘다. 접미사 하나가 "계산된 관계" 와 "지어낸 신살" 을 가른다.
   */
  '삼형살',
  '공망', '백호', '귀문', '양인', '천라지망', '겁살', '재살', '천살', '월살',
  '망신살', '장성살', '반안살', '육해살', '화개살', '상문살', '조객살', '고신살',
  '과숙살', '홍염살', '금여', '암록', '천의성', '복성', '격각', '십악대패',
  '비인살', '음착', '양착', '원진살', '역마살', '천생연분', '궁합 점수',
  '띠궁합', '겉궁합', '속궁합'
]);

const UNCOMPUTED_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'uncomputed-myeongri',
    reason: '엔진이 계산하지 않는 명리 개념. 근거 집합을 만들 수 없으므로 전량 금지다.',
    patterns: UNCOMPUTED_MYEONGRI_TOKENS.map((token) => new RegExp(token.replace(/ /gu, '\\s*'), 'u'))
  }
]);

/* ------------------------------------------------------------------ *
 * 조립
 * ------------------------------------------------------------------ */

const ALL_RULES: readonly IntentRule[] = Object.freeze([
  ...CONTACT_RULES,
  ...PARTNER_RULES,
  ...HOPE_RULES,
  ...OBSESSION_RULES,
  ...BANMAL_RULES,
  ...MINIMUM_RULES,
  ...UNCOMPUTED_RULES
]);

/**
 * 차단·거절·학대 상태에서만 추가로 거는 규칙.
 *
 * 권유 어미가 없어도 **접촉을 허용하는 서술 자체**를 거부한다.
 * `'지금은 연락을 열어도 괜찮은 자리예요'` 는 권유가 아니라 판정이지만,
 * 차단·미확인 상태에서는 그 판정이 곧 권유로 읽힌다.
 */
const CONTACT_WITHHELD_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'contact-solicitation',
    reason: '차단·거절·미확인 상태다. 이 상태에서 허용되는 조언은 보류·기록·일상뿐이다.',
    patterns: [
      /(?:연락|접촉|대화|만남|메시지|문자|전화)[^.!?\n]{0,24}(?:괜찮|가능|열(?:려|어|린)|되는 (?:자리|시기|때)|해도|무리 없)/u,
      /(?:지금|오늘|이번 주|이번 달)[^.!?\n]{0,18}(?:연락|메시지|문자|전화|대화|만남)/u,
      /(?:다시|먼저)\s*(?:만나|보자|보시|연락)/u
    ]
  }
]);

/** 학대 신호가 있을 때만 거는 규칙. 안전 거리 외의 어떤 설계도 허용하지 않는다. */
const HARM_SIGNAL_RULES: readonly IntentRule[] = Object.freeze([
  {
    category: 'contact-solicitation',
    reason: '통제·폭력·위협 신호가 독자 서술에 있다. 접촉 설계 자체를 쓰지 않는다.',
    patterns: [
      /(?:다시 만나|재회|관계를 회복|화해|다시 시작|돌아가)/u,
      /(?:이해해 (?:주|보)|용서|참고 견디|기다려 (?:주|보))/u,
      /(?:대화로 풀|잘 얘기하면|진심을 전하면)/u
    ]
  }
]);

export interface ReunionIntentContext {
  /** 차단·미확인이면 접촉 서술 자체를 거부한다. 미입력이면 `unknown` 취급이 아니라 무제약이다. */
  contactStatus?: ReunionContactStatus | null;
  /** CH02 판독표의 '거절이나 중단 요청이 있었다'. */
  refusalObserved?: boolean;
  /** `findReunionHarmSignals` 결과가 하나라도 있으면 true. */
  harmSignalDetected?: boolean;
}

/**
 * 접촉 권유를 **전면 금지**해야 하는 상태인가.
 *
 * `contactStatus` 가 애초에 서버에 도달하지 않으면 이 함수는 false 를 돌려주고
 * 기본 8축 검사만 남는다. 배선이 끝날 때까지 조용히 통과하지 않도록
 * `geminiProseGuard.proseGuardModeFor` 쪽에서 별도로 모드를 내린다.
 */
export function isContactWithheld(context: ReunionIntentContext | null | undefined): boolean {
  if (!context) return false;
  return Boolean(
    context.refusalObserved ||
    context.harmSignalDetected ||
    context.contactStatus === 'blocked' ||
    context.contactStatus === 'unknown'
  );
}

function matchRules(rules: readonly IntentRule[], sentence: string, out: ReunionIntentViolation[]) {
  const exempt = hasDisclaimer(sentence);
  rules.forEach((rule) => {
    if (exempt && EXEMPTABLE_CATEGORIES.has(rule.category)) return;
    rule.patterns.forEach((pattern) => {
      const found = pattern.exec(sentence);
      if (found) out.push({ category: rule.category, match: found[0], reason: rule.reason });
    });
  });
}

/**
 * 의도 단위 위반 목록. **절대 검사다** — base 차감을 하지 않는다.
 *
 * 문장 단위로 쪼개 검사한다. 한 문단을 통째 넘기면
 * `'연락 상태를 확인하지 못했어요. 일상을 먼저 챙겨 보세요.'` 처럼
 * 서로 다른 문장의 조각이 붙어 접촉 권유로 오탐한다.
 */
export function findReunionIntentViolations(
  text: string,
  context?: ReunionIntentContext | null
): ReunionIntentViolation[] {
  if (typeof text !== 'string' || !text.trim()) return [];

  const withheld = isContactWithheld(context);
  const harm = Boolean(context?.harmSignalDetected);
  const violations: ReunionIntentViolation[] = [];

  text.split(SENTENCE_SPLIT).forEach((raw) => {
    const sentence = raw.trim();
    if (!sentence) return;
    matchRules(ALL_RULES, sentence, violations);
    if (withheld) matchRules(CONTACT_WITHHELD_RULES, sentence, violations);
    if (harm) matchRules(HARM_SIGNAL_RULES, sentence, violations);
  });

  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = `${violation.category}:${violation.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 위반 라벨. 로그·거부 메시지에 고객 문장을 싣지 않기 위해 카테고리만 돌려준다. */
export function reunionIntentLabels(
  text: string,
  context?: ReunionIntentContext | null
): string[] {
  return [...new Set(findReunionIntentViolations(text, context).map((violation) => violation.category))];
}

/**
 * `ReunionContext` → 가드 컨텍스트.
 *
 * 학대 신호는 독자의 자유 서술(`breakupReason`·`notes`)**과 유료 질문**에서 함께 찾는다.
 * 질문은 프롬프트에 그대로 직렬화돼 나가므로(`deterministicBasis.input.questions`),
 * `'그 사람이 저를 때렸는데 다시 만나도 될까요'` 같은 질문에 모델이 답을 쓰는 경로가
 * 이미 열려 있다. 게이트(`gate.ts:91`)는 클라이언트에만 있어 이 경로를 못 본다.
 */
export function toReunionIntentContext(
  context: ReunionContext | null | undefined,
  questions: readonly string[] = []
): ReunionIntentContext {
  const harmSignals = findReunionHarmSignals(
    context?.breakupReason,
    context?.notes,
    ...questions
  );
  return {
    contactStatus: context?.contactStatus ?? null,
    refusalObserved: false,
    harmSignalDetected: harmSignals.length > 0
  };
}
