# Gemini Premium Saju Backend Prompt

프롬프트 전문은 **이 문서에 없다.** 소스가 유일한 원본이다.

| 무엇 | 어디 |
|---|---|
| 프롬프트 상수 전체 | [`src/lib/saju/premiumReportPrompt.ts`](../src/lib/saju/premiumReportPrompt.ts) |
| 요청 조립(파트 분리·스키마·온도) | [`buildGeminiRequestPayload`](../src/lib/server/geminiReportService.ts) |
| 재회운 컷 카피 스키마·하드스펙 | [`src/lib/server/geminiReunionCopy.ts`](../src/lib/server/geminiReunionCopy.ts) |
| 무엇을 풀고 무엇을 잠가 두는지 | [`ai-prose-unlock-decision.md`](./ai-prose-unlock-decision.md) |
| 골든 테스트 케이스 | `PREMIUM_SAJU_GOLDEN_TEST_CASE` (같은 파일) |

- mode: `PREMIUM_SAJU_REPORT_MODE`
- version: `PREMIUM_SAJU_PROMPT_VERSION`

## 왜 전문 복제를 지웠나

이 문서에는 `premium_saju_comprehensive_v1` 시절 프롬프트 전문이 복사돼 있었고, 실제 코드는
그때 이미 v4였다. 소스 링크도 다른 PC의 절대경로(`/C:/Users/1/Documents/...`)로 깨져 있어
"최신 프롬프트를 보려면 어디를 봐야 하는가"에 이 문서가 **틀린 답**을 주고 있었다.

복제본에 남아 있던 내용 중 특히 위험했던 것:

- 골든 테스트 1인(차민호 / 1992-09-09)의 **해석 결론**이 "해석 방향 필수 조건" 8개로 박혀 있었다
  (`이 사주는 기획과 구조로 돈을 만드는 타입으로 읽는다`, `현재 임자 대운은 …`). 이것을 다른
  고객의 프롬프트에 그대로 넣으면 전원이 같은 리포트를 받는다. 현재 코드의
  `PREMIUM_SAJU_SYSTEM_PROMPT`는 반대로 **골든 케이스 값을 복사하지 말라**고 명시한다.
- `section id` 순서가 현재 `PREMIUM_SAJU_REQUIRED_SECTION_IDS`와 다르다.
- echo 잠금 / 근거 인용 의무 / 재회운 안전 오버라이드가 전혀 반영돼 있지 않다.

프롬프트는 상수 파일에서 상품별로 조립된다. 문서에 복제하면 그 순간부터 갈라지므로,
이 문서는 **어디를 봐야 하는지만** 말한다.

## 구조 요약 (2026-09 기준)

요청 한 건의 구성:

1. `systemInstruction` — 사실 제약만. 어기면 필드가 버려지는 규칙.
   - `PREMIUM_SAJU_SYSTEM_PROMPT` (역할·수정 가능/금지 필드)
   - `PREMIUM_SAJU_FACT_CONSTRAINTS` (근거 인용 의무, 엔티티 금지, 배열 모양, 길이 상한)
   - 상품 분기: `love-reunion` → `LOVE_REUNION_OUTPUT_SAFETY_OVERRIDE` +
     `LOVE_REUNION_AUTHORED_PROSE_CONTRACT` + `LOVE_REUNION_VOICE_SPEC`,
     그 외 → `PREMIUM_SAJU_STRICT_ECHO_RULE`
2. `contents[0].parts[0]` — 데이터. `deterministicBasis`, `baseReport`, `evidenceIdCatalog`,
   `claimLedger`.
3. `contents[0].parts[1]` — 문체·구성 지침(`PREMIUM_SAJU_HUMAN_SENSORY_POLICY` +
   `PREMIUM_SAJU_STYLE_DIRECTIVES`). 어겨도 필드가 버려지지 않는다.
4. `contents[0].parts[2]` — (재회운 + 컷 페이로드 있을 때만) 컷 카피 하드스펙과 쓸 수 있는 컷 목록.

`generationConfig.temperature`는 `love-reunion` 0.75, 나머지 0. 근거는
`geminiReportService.ts`의 `LOVE_REUNION_TEMPERATURE` 주석에 있다.
