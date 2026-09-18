/**
 * 프롬프트 잠금 해제 계약 (명세 §4-2, §4-5, §4-6).
 *
 * 이 파일이 잠그는 것은 **어느 상품이 어떤 지침을 받는가**다.
 * 재회운에서 echo 잠금이 되살아나거나, 다른 상품에서 잠금이 사라지는 회귀를 막는다.
 * 후자가 더 위험하다 — 다른 상품은 코드가 아직 `strict-echo` 이므로 잠금이 빠지면
 * 100% `base-mismatch` 로 거부돼 전 요청이 결정론 fallback 으로 떨어진다.
 */

import { describe, expect, it } from 'vitest';
import { buildReunionReportPayload } from '../reunion/chapters';
import { REUNION_BUBBLE_SPEC, REUNION_TERM_KEYS } from '../reunion/glossary';
import { REUNION_UNDELETABLE_COPY } from '../reunion/safetyCopy';
import { REUNION_CONTEXT_VERSION, type ReunionContext } from '../reunion/types';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import { buildGeminiRequestPayload } from './geminiReportService';
import { writableReunionCuts } from './geminiReunionCopy';

const reunionFormData = {
  name: '재회 검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'breakup-reunion' as const,
  partner: {
    name: '상대 검증자',
    gender: 'male' as const,
    calendar: 'solar' as const,
    isLeapMonth: false,
    birthDate: '1991-05-14',
    birthTime: '08:30',
    isUnknownTime: false
  },
  q1: '다시 연락해도 될까요?',
  q2: '답이 없으면 언제 멈춰야 하나요?'
};

const generalFormData = {
  name: '검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '올해 일의 방향은 무엇인가요?',
  q2: ''
};

const reunionContext: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'threeTo6m',
  contactStatus: 'occasional',
  lastContactAt: '2026-08-20',
  breakupReason: '대화 방식이 달라 여러 번 부딪혔어요.',
  desiredOutcome: 'clarity',
  notes: '돌려받을 물건이 하나 있어요.',
  consentToUsePartnerData: true
};

type PromptPayload = ReturnType<typeof buildGeminiRequestPayload>;

function buildPrompt(serviceId: 'love-reunion' | 'general-signature' | 'love-reading', withCuts = false) {
  const formData = serviceId === 'general-signature' ? generalFormData : reunionFormData;
  const basis = buildDeterministicSajuBasis(serviceId, formData);
  const report = buildSajuReport(serviceId, formData, basis);
  const withPayload = withCuts
    ? { ...report, reunion: buildReunionReportPayload({ report, context: reunionContext }) }
    : report;
  return { report: withPayload, payload: buildGeminiRequestPayload(withPayload, basis) };
}

const systemText = (payload: PromptPayload) =>
  payload.systemInstruction.parts.map((part) => part.text).join('\n');
const userParts = (payload: PromptPayload) => payload.contents[0].parts.map((part) => part.text);
const wholePrompt = (payload: PromptPayload) => JSON.stringify(payload);

/** 잠금 문구의 지문. 이 세 조각이 재회운 프롬프트에 다시 나타나면 해제가 되돌려진 것이다. */
const ECHO_LOCK_FINGERPRINTS = [
  'copy the corresponding baseReport string byte-for-byte',
  'Return only exact deterministic prose echoes',
  'Your only permitted operation is exact baseReport prose echo'
];

describe('재회운 — 산문 잠금 해제', () => {
  it('잠금 3줄이 프롬프트에서 사라졌다', () => {
    const prompt = wholePrompt(buildPrompt('love-reunion').payload);
    ECHO_LOCK_FINGERPRINTS.forEach((fingerprint) => {
      expect(prompt).not.toContain(fingerprint);
    });
    expect(prompt).not.toContain('FINAL RELEASE-SAFE OVERRIDE');
  });

  it('새 문장을 쓸 권한과 그 대가를 systemInstruction 으로 준다', () => {
    const text = systemText(buildPrompt('love-reunion').payload);
    expect(text).toContain('You author original Korean prose');
    expect(text).toContain('CITATION IS MANDATORY');
    expect(text).toContain('NO NEW ENTITIES');
    expect(text).toContain('ARRAY SHAPE IS FIXED');
    // 실패한 필드만 되돌아간다는 사실을 모델에게 알려야 필드를 억지로 채우지 않는다.
    expect(text).toContain('Partial success is a normal, good outcome');
  });

  it('안전 규격은 해제 뒤에도 그대로, 오히려 4개 조항이 늘었다', () => {
    const text = systemText(buildPrompt('love-reunion').payload);
    expect(text).toContain('LOVE-REUNION SAFETY OVERRIDE');
    expect(text).toContain('Never claim to know the partner');
    expect(text).toContain('Never present a year, month, day, or date as guaranteed');
    expect(text).toContain('Never encourage obsession or repeated approach');
    expect(text).toContain('Never propose surveillance');
    expect(text).toContain('never suggest contact, a re-approach route, an alternate account');
    expect(text).toContain('Never manufacture hope');
    // per-field fallback 과 정합해야 한다. 필드를 비우면 그 자리에 구멍이 남는다.
    expect(text).toContain('fall back to the deterministic base value for that field');
    expect(text).not.toContain('Omit an unsafe field instead of inventing a replacement');
  });

  it('운월당 목소리 규격을 박는다', () => {
    const text = systemText(buildPrompt('love-reunion').payload);
    expect(text).toContain('UNWOLDANG VOICE');
    expect(text).toContain('{이름}님');
    expect(text).toContain('그 사람');
    expect(text).toContain('반말');
  });

  it('문체 지침은 systemInstruction 이 아니라 별도 파트로 나간다', () => {
    const { payload } = buildPrompt('love-reunion');
    const parts = userParts(payload);

    expect(systemText(payload)).not.toContain('STYLE AND COMPOSITION');
    expect(parts[1]).toContain('=== STYLE AND COMPOSITION');
    // 사실 데이터는 첫 파트에만 있다.
    expect(parts[0]).toContain('deterministicBasis');
    expect(parts[0]).not.toContain('STYLE AND COMPOSITION');
  });

  /**
   * 재회운은 **감각 정책과 범용 스타일 지침을 받지 않는다.**
   *
   * 잠금이 살아 있던 동안에는 `FINAL RELEASE-SAFE OVERRIDE` 가 문체 지침 전체를
   * 무효화해서 충돌이 드러나지 않았다. 잠금을 걷어낸 순간 같은 요청에
   * '팩폭하라' 와 '훈계하지 말라' 가 함께 나가기 시작했고, 어느 쪽이 이길지
   * 알 수 없는 상태가 됐다. 그 조각들이 재회운 프롬프트에 다시 나타나면 회귀다.
   */
  it('재회운에는 팩폭·NO HEDGING·viral 지침이 나가지 않는다', () => {
    const prompt = wholePrompt(buildPrompt('love-reunion').payload);
    [
      'TOP PRIORITY',
      'NO HEDGING STYLE',
      '팩폭',
      'capture-worthy',
      'feels viral',
      'Do not soften every sentence with hedging',
      'how the other person reads the customer',
      'give concrete meeting routes and places',
      'veteran consultant who has already seen'
    ].forEach((fingerprint) => {
      expect(prompt, fingerprint).not.toContain(fingerprint);
    });
  });

  it('재회운은 안전 규격과 호환되는 전용 문체 배열을 받는다', () => {
    const parts = userParts(buildPrompt('love-reunion').payload);
    expect(parts[1]).toContain('Hedging is correct in this product');
    expect(parts[1]).toContain('Never write a line designed to be screenshotted');
    expect(parts[1]).toContain('Both outcomes stay equally weighted');
  });

  it('다른 상품은 감각 정책과 범용 스타일 지침을 그대로 받는다', () => {
    const parts = userParts(buildPrompt('general-signature').payload);
    expect(parts[1]).toContain('TOP PRIORITY');
    expect(parts[1]).toContain('capture-worthy one-liner');
  });

  /**
   * 관계 상태와 밴드별 금지어는 **프롬프트에 실제로 나가야 한다.**
   * 코드만 거부하면 모델이 같은 실수를 반복해 거부율만 오른다.
   */
  it('관계 상태와 밴드별 금지어를 프롬프트에 싣는다', () => {
    const withheld = buildGeminiRequestPayload(
      buildPrompt('love-reunion').report,
      buildDeterministicSajuBasis('love-reunion', reunionFormData),
      { reunionContext: { ...reunionContext, contactStatus: 'blocked' } }
    );
    const guard = withheld.contents[0].parts.map((part) => part.text).join('\n');

    expect(guard).toContain('CONTACT IS WITHHELD');
    expect(guard).toContain("contactStatus (from the reader's own intake): blocked");
    expect(guard).toContain('READER STATE AND BANNED EXPRESSIONS');
    // 공통 금지어 표가 직렬화돼 나간다.
    expect(guard).toContain('감시 유도');
  });

  it('학대 신호가 있으면 접촉 설계 금지 지시가 함께 나간다', () => {
    const payload = buildGeminiRequestPayload(
      buildPrompt('love-reunion').report,
      buildDeterministicSajuBasis('love-reunion', reunionFormData),
      {
        reunionContext: {
          ...reunionContext,
          breakupReason: '화가 나면 물건을 던지고 소리를 질렀어요.'
        }
      }
    );
    const guard = payload.contents[0].parts.map((part) => part.text).join('\n');
    expect(guard).toContain('HARM SIGNAL');
    expect(guard).toContain('Reunion design is off entirely');
  });

  it('근거 ID 원장을 함께 넘긴다 (ID 목록만으로는 근거를 보고 쓸 수 없다)', () => {
    const { payload } = buildPrompt('love-reunion');
    const data = JSON.parse(userParts(payload)[0] || '{}') as {
      claimLedger?: Array<{ id: string; statement: string }>;
      evidenceIdCatalog?: Record<string, string[]>;
    };

    expect(data.claimLedger?.length || 0).toBeGreaterThan(5);
    data.claimLedger?.forEach((entry) => {
      expect(entry.id).toBeTruthy();
      expect(entry.statement.length).toBeGreaterThan(0);
    });
    // 원장의 ID 는 범위 검사가 쓰는 카탈로그와 같은 세계에 있어야 한다.
    const catalogIds = new Set(Object.values(data.evidenceIdCatalog || {}).flat());
    expect(data.claimLedger?.some((entry) => catalogIds.has(entry.id))).toBe(true);
  });

  it('온도를 0.75 로 올린다 — 문체 지침과 temperature 0 은 자기모순이다', () => {
    expect(buildPrompt('love-reunion').payload.generationConfig.temperature).toBe(0.75);
  });
});

describe('다른 상품 — 현행 유지', () => {
  it('종합사주는 echo 잠금과 temperature 0 을 그대로 받는다', () => {
    const { payload } = buildPrompt('general-signature');
    const text = systemText(payload);

    expect(text).toContain('RELEASE-SAFE OUTPUT RULE');
    expect(text).toContain('copy the corresponding baseReport string byte-for-byte');
    expect(text).toContain('Your only permitted operation is exact baseReport prose echo');
    expect(text).not.toContain('You author original Korean prose');
    expect(text).not.toContain('LOVE-REUNION SAFETY OVERRIDE');
    expect(payload.generationConfig.temperature).toBe(0);
  });

  it('연애운은 재회운 안전 오버라이드를 받지 않는다', () => {
    expect(wholePrompt(buildPrompt('love-reading').payload)).not.toContain('LOVE-REUNION SAFETY OVERRIDE');
  });

  it('사실 제약은 모든 상품이 공유한다', () => {
    ['love-reunion', 'general-signature', 'love-reading'].forEach((serviceId) => {
      const text = systemText(buildPrompt(serviceId as 'love-reunion').payload);
      expect(text).toContain('FACT DISCIPLINE');
      expect(text).toContain('Never change pillars, fiveElements, tenGods');
      expect(text).toContain('calculation-audit-v2');
    });
  });
});

describe('컷 카피 스키마 — 컷 페이로드가 있을 때만 열린다', () => {
  it('컷 페이로드가 없으면 reunionCopy 필드를 아예 만들지 않는다', () => {
    const { payload } = buildPrompt('love-reunion');
    const properties = payload.generationConfig.responseSchema.properties as Record<string, unknown>;
    expect(properties.reunionCopy).toBeUndefined();
    expect(wholePrompt(payload)).not.toContain('REUNION CUT COPY');
  });

  it('컷 페이로드가 있으면 cutId 를 base 가 정한 enum 으로 못박는다', () => {
    const { report, payload } = buildPrompt('love-reunion', true);
    const properties = payload.generationConfig.responseSchema.properties as Record<string, {
      maxItems?: number;
      items?: { required?: string[]; properties?: Record<string, { enum?: string[]; maxItems?: number }> };
    }>;
    const schema = properties.reunionCopy;
    const writableIds = writableReunionCuts(report.reunion!).map((cut) => cut.id);

    expect(schema?.items?.required).toEqual(['cutId', 'claimRefs']);
    expect(schema?.items?.properties?.cutId.enum).toEqual(writableIds);
    expect(schema?.maxItems).toBe(writableIds.length);
    expect(schema?.items?.properties?.bubbles.maxItems).toBe(REUNION_BUBBLE_SPEC.maxBubblesPerCut);
    // 번역은 사전이 독점한다. 모델은 키만 고른다.
    expect(schema?.items?.properties?.evidenceBadge.enum)
      .toEqual(REUNION_TERM_KEYS.map((term) => `[${term}]`));
  });

  it('카피 하드스펙과 금지어 표를 프롬프트에 그대로 박는다', () => {
    const { payload } = buildPrompt('love-reunion', true);
    // 재회운은 관계 상태·금지어 파트가 하나 더 붙으므로 컷 지침은 마지막 파트다.
    const parts = userParts(payload);
    const directives = parts[parts.length - 1] || '';

    expect(directives).toContain('REUNION CUT COPY');
    expect(directives).toContain(`at most ${REUNION_BUBBLE_SPEC.maxChars} characters`);
    expect(directives).toContain(`at most ${REUNION_BUBBLE_SPEC.maxLines} lines`);
    expect(directives).toContain(`at most ${REUNION_BUBBLE_SPEC.maxCharsPerLine} characters per line`);
    expect(directives).toContain('Over-length text is discarded, not truncated');
    // 금지어 표(§6-E)와 삭제 불가 문구(§6-F)
    expect(directives).toContain('감시 유도');
    expect(directives).toContain('매달리지 마세요');
    expect(directives).toContain(REUNION_UNDELETABLE_COPY['readiness-not-probability']);
    REUNION_TERM_KEYS.forEach((term) => expect(directives).toContain(term));
  });

  it('영구 잠금 컷은 쓸 수 있는 컷 목록에 들어가지 않는다', () => {
    const { report, payload } = buildPrompt('love-reunion', true);
    const schema = (payload.generationConfig.responseSchema.properties as Record<string, {
      items?: { properties?: Record<string, { enum?: string[] }> };
    }>).reunionCopy;
    const writableIds = new Set(schema?.items?.properties?.cutId.enum || []);
    const allCuts = report.reunion!.chapters.flatMap((chapter) => chapter.cuts);
    const lockedCuts = allCuts.filter((cut) => cut.undeletableCopyId || cut.layout === 'beat');

    expect(lockedCuts.length).toBeGreaterThan(0);
    lockedCuts.forEach((cut) => expect(writableIds.has(cut.id)).toBe(false));
    expect(writableIds.size).toBeLessThan(allCuts.length);
  });
});
