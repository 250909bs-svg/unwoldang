type PastLifeNarrativeAudit = {
  safe: boolean;
  violations: string[];
};

type NarrativeRule = {
  code: string;
  patterns: readonly RegExp[];
};

const SAFE_SYMBOLIC_REPLACEMENT =
  '이 장면은 과거를 증명하는 기록이 아닙니다. 사주에 나타난 반복 기질을 상징 서사로 풀어, 지금 확인할 수 있는 선택과 행동을 돌아보는 해석입니다.';

const NARRATIVE_RULES: readonly NarrativeRule[] = [
  {
    code: 'past-life-certainty',
    patterns: [
      /(?:실제|진짜)\s*(?:전생|과거\s*생)(?:의)?\s*기억/u,
      /(?:전생|과거\s*생)(?:의)?\s*기억(?:이|을|은)?[^.!?\n]{0,30}(?:돌아왔|되찾았|떠올랐|복원됐|확인됐|검증됐|분명하)/u,
      /(?:당신|고객|[가-힣]{1,12}님)?(?:의\s*)?전생(?:은|이)\s*[^.!?\n]{1,50}(?:입니다|이다|이었(?:습니다|다|어요|음)|였(?:습니다|다|어요|음))/u,
      /(?:전생|과거\s*생)(?:에서|에는|에)\s*[^.!?\n]{1,48}(?:이었|였|살았|태어났)(?:습니다|다|어요|음)/u,
      /(?:조선(?:\s*시대)?|고려(?:\s*시대)?|삼국(?:\s*시대)?|신라|백제|고구려|대한제국|일제\s*강점기|중세|고대|왕조|궁중|왕실)[^.!?\n]{0,52}(?:왕|왕비|궁녀|무당|재판관|장군|승려|의관|관료|사제|선비|상인|노비|군인|무사|기록관|점술가|예언자)(?:이었|였)(?:습니다|다|어요|음)/u,
    ],
  },
  {
    code: 'verified-history-certainty',
    patterns: [
      /검증된\s*(?:역사적?\s*)?(?:사실|기록)/u,
      /역사적으로\s*(?:검증|확인)(?:되었|됐|된|되었습니다)/u,
      /(?:공식\s*)?(?:사료|역사\s*기록)(?:로|에서)\s*(?:확인|검증)(?:되었|됐|된|되었습니다)/u,
      /(?:실제\s*)?역사적?\s*사실(?:로|이라고)\s*(?:확인|검증|증명)/u,
    ],
  },
  {
    code: 'death-certainty',
    patterns: [
      /(?:전생|과거\s*생)[^.!?\n]{0,60}(?:살해당했|죽었|사망했|처형당했|익사했|화형당했|전사했|병사했|자결했)(?:습니다|다|기\s*때문|던)/u,
      /(?:전생|과거\s*생)(?:의|에서)?\s*(?:사망|죽음)\s*원인(?:은|이|:)[^.!?\n]{1,40}(?:입니다|이다|였습니다|였다)/u,
    ],
  },
  {
    code: 'curse-karma-certainty',
    patterns: [
      /(?:전생의?\s*)?(?:저주|업보)(?:가|는|이)?\s*[^.!?\n]{0,24}(?:확실|확정|분명|실재|걸렸|남아\s*있|따라다니|원인|때문)/u,
      /(?:불행|질병|사고|이별|가난|실패)(?:은|이|의\s*원인은)[^.!?\n]{0,36}(?:전생의?\s*)?(?:저주|업보)(?:\s*때문|\s*탓)/u,
      /(?:전생|과거\s*생)(?:의|에서)[^.!?\n]{0,32}(?:죄|악행)[^.!?\n]{0,32}(?:대가|업보|벌)(?:입니다|이다|받고\s*있|때문)/u,
    ],
  },
  {
    code: 'fear-payment-pressure',
    patterns: [
      /(?:부적|굿|기도|의식|천도재|결제|구매|입금)[^.!?\n]{0,52}(?:하지\s*않|안\s*하|없으면|미루면)[^.!?\n]{0,52}(?:불행|사고|재앙|저주|화가|죽|질병|파국|이별)/u,
      /(?:저주|업보|재앙|불행)[^.!?\n]{0,40}(?:풀|막|피하)[^.!?\n]{0,30}(?:결제|구매|입금|부적|굿|천도재)/u,
      /(?:지금|당장)[^.!?\n]{0,20}(?:결제|구매|입금)[^.!?\n]{0,24}(?:해야|하십시오|하셔야)[^.!?\n]{0,36}(?:안전|저주|불행|재앙|화를\s*피)/u,
    ],
  },
  {
    code: 'internal-model-leak',
    patterns: [
      /(?:\b(?:AI|Gemini|OpenAI|ChatGPT|GPT-?\d*|LLM)\b|제미나이)(?:가|이|에서|로)?[^.!?\n]{0,32}(?:생성|작성|출력|지시받|내부\s*프롬프트|시스템\s*지시)/iu,
      /(?:내부|시스템|숨겨진|개발자)\s*(?:시스템\s*)?(?:프롬프트|메시지|지시문?)/u,
      /(?:system|internal|developer)\s+(?:prompt|message|instruction)/iu,
      /(?:모델|인공지능)(?:이|가)?\s*(?:생성|작성|출력|지시받)/u,
    ],
  },
] as const;

const NEGATION_PATTERN =
  /(?:아니(?:다|며|고|라|라고|라고요|었습니다|ㅂ니다)?|아닙니다|않(?:다|으며|습니다|는다|은|는)?|없(?:다|습니다|으며|는)?|단정하지|확정하지|증명하지|검증하지|확인할\s*수\s*없|사실로\s*보지)/u;

const SYMBOLIC_QUALIFIER_PATTERN =
  /(?:상징|비유|가정|창작|서사)\s*(?:적으로|적인|적|에서|속|상|의)?/u;
const SYMBOLIC_REVERSAL_PATTERN =
  /(?:상징|비유|가정|창작|서사)[^.!?。！？]{0,32}(?:아니|않|보이지만|보여도|이지만|하지만|그렇지만|그러나|반면|불과|뿐|달리)/u;

function normalizedNarrative(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function isNegated(text: string, start: number, length: number) {
  const before = text
    .slice(Math.max(0, start - 48), start)
    .split(/[.!?。！？]/u)
    .at(-1) ?? '';
  const after = text
    .slice(start + length, Math.min(text.length, start + length + 64))
    .split(/[.!?。！？]/u)[0] ?? '';
  const hasDirectNegation =
    NEGATION_PATTERN.test(before) && !SYMBOLIC_REVERSAL_PATTERN.test(before);
  return hasDirectNegation || NEGATION_PATTERN.test(after);
}

function isSymbolicallyQualified(text: string, start: number, matchedText: string) {
  const before = text
    .slice(Math.max(0, start - 48), start)
    .split(/[.!?。！？]/u)
    .at(-1) ?? '';
  const context = `${before} ${matchedText}`;
  return SYMBOLIC_QUALIFIER_PATTERN.test(context) && !SYMBOLIC_REVERSAL_PATTERN.test(context);
}

function hasUnsafeMatch(text: string, pattern: RegExp) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);

  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    const matchedText = match[0];

    if (isNegated(text, start, matchedText.length)) continue;
    if (isSymbolicallyQualified(text, start, matchedText)) continue;
    return true;
  }

  return false;
}

export function auditPastLifeNarrative(text: string): PastLifeNarrativeAudit {
  const normalized = normalizedNarrative(text);
  if (!normalized) return { safe: true, violations: [] };

  const violations = NARRATIVE_RULES.flatMap((rule) =>
    rule.patterns.some((pattern) => hasUnsafeMatch(normalized, pattern)) ? [rule.code] : []
  );

  return {
    safe: violations.length === 0,
    violations,
  };
}

export function sanitizePastLifeNarrative(text: string): string {
  return auditPastLifeNarrative(text).safe ? text : SAFE_SYMBOLIC_REPLACEMENT;
}
