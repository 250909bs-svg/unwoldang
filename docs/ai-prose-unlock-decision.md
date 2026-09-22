# ADR — 제미나이 산문 잠금 해제 (재회운 한정)

- 날짜: 2026-09-18
- 상태: 채택. 재회운(`love-reunion`)만 열림. 다른 상품은 현행 유지.
- 관련 코드: `src/lib/saju/premiumReportPrompt.ts`, `src/lib/server/geminiReportService.ts`,
  `src/lib/server/geminiProseGuard.ts`, `src/lib/server/geminiReunionCopy.ts`

## 1. 배경 — 잠금이 왜 있었는지 기록이 없었다

프롬프트 끝에 이런 지침이 박혀 있었다.

> FINAL RELEASE-SAFE OVERRIDE: all earlier style and quality instructions … do not authorize new
> prose. Your only permitted operation is exact baseReport prose echo plus valid evidence metadata.

같은 취지의 지침이 셋이었다(echo 규칙 / 새 주장 금지 / 최종 오버라이드). 효과는 분명하다 —
모델은 **결정론 리포트 문장을 그대로 복사하고 근거 ID만 덧붙이는 일**만 할 수 있었다.
그 앞에 있던 문체 지침 40여 개와 `PREMIUM_SAJU_HUMAN_SENSORY_POLICY`는 토큰만 태웠다.
리포트는 "AI가 쓴 글"이 아니라 "미리 계산된 문장의 복사"였다.

**왜 그렇게 했는지는 어느 커밋 메시지에도, 어느 문서에도 없었다.** 이 ADR이 그 공백을 메운다.
추정되는 이유는 하나뿐이고 타당하다: 검증 장치가 **바이트 일치 비교밖에 없었기 때문**이다.
`geminiReportService.ts`의 옛 `validateGeneratedProse`는 모델이 돌려준 모든 산문 필드를
결정론 `baseReport`와 바이트 단위로 비교했고, 한 필드라도 다르면 draft 전체를 버렸다.
그 상태에서 프롬프트를 풀면 **전 요청이 100% 거부되어 지금보다 나빠진다.**

## 2. 결정

순서를 **코드 → 프롬프트**로 잡는다.

1. (선행 단계) 바이트 일치를 3단 검증으로 교체하고 all-or-nothing을 per-field fallback으로 바꾼다.
   `geminiProseGuard.ts` + `reviewGeminiDraft`.
2. (이 단계) 프롬프트에서 echo 잠금 3줄을 **재회운에서만** 걷어내고, 사실 제약과 문체 지침을
   물리적으로 분리한다. 온도를 0.75로 올린다.

## 3. 무엇을 풀었나

| 대상 | 이전 | 이후 |
|---|---|---|
| `heroNote`, `summary`, `keyTakeaways`, `questionAnswers`, 고객 섹션 `paragraphs`/`cards`/`details`/`callout`, `currentDayun`/`nextDayun`, `actionPlan` | 바이트 echo만 | 근거를 붙인 **새 한국어 문장** 채택 |
| 문체 지침 40여 개 + 감각 정책 | echo 규칙에 눌려 무효 | `contents`의 별도 파트로 분리되어 작동 |
| 온도 | 0 | 0.75 (재회운만) |
| 근거 전달 | ID 문자열 목록만 | ID + 그 ID가 주장하는 문장(`claimLedger`) |
| 컷 카피 | 없음 | `reunionCopy` 스키마(말풍선·나레이션·캡션·근거 배지), 컷 단위 검증 |

풀린 것은 **문체·구성·컷 나누기**뿐이다. 사실 주장은 여전히 결정론 계산에 고정된다.

## 4. 무엇을 영구 잠금으로 유지하나

1. **삭제 불가 문구 7개** (`src/lib/reunion/safetyCopy.ts`의 `REUNION_UNDELETABLE_COPY`).
   이 문구가 들어 있는 필드는 `authored` 모드에서도 바이트 일치를 요구하고,
   이 문구를 싣는 컷은 모델에게 아예 열리지 않는다.
2. **계산 근거 섹션** — id가 `-v2`로 끝나는 네 섹션(`calculation-audit-v2`,
   `expert-evidence-v2`, `temporal-evidence-v2`, `compatibility-evidence-v2`).
   sanitize·merge·lock 3중으로 막힌다.
3. **계산값 전부** — `pillars` / `fiveElements` / `tenGods` / 대운 이름·구간 / `yearLuck` /
   `monthLuck` / 생년월일 / `serialNumber` / `createdAt`. `lockCommercialReportFacts`가 복원한다.
4. **판정값** — 재회운 컷 페이로드의 게이트 판정, 조건 개수, 제안 날짜, `sceneKey`, `layout`,
   `chapterId`, `cutId`, `mask`. 모델의 응답 스키마에 **그 필드 자체가 없다.**
5. **명리 용어 번역** — `REUNION_TERM_GLOSSARY`가 유일한 번역이다. 모델은 어느 용어를 달지만
   고르고, 번역문은 사전 값으로 대체된다.
6. **재회운 안전 규격 13개 조항** — 확률·속마음·보장·날짜 단정 4개에 1차 해제에서 4개
   (집착 조장, 감시 유도, 차단·거절 시 접촉 권유, 근거 없는 희망), 2차 심사 반영으로 5개
   (정도 부사 단정, 조건부 약속, 학대·폭력 오버라이드, 연령 무관 최소선, 미계산 개념)를 더했다.
   **조항마다 집행 코드가 있다** — §9-1의 대응표 참조. 집행 없는 조항을 추가하지 마라.
7. **재회운 heroNote** — 리포트 최상단의 유일한 경계 선언. §9-7 참조.
8. **다른 상품 전부** — `promptRelease.AUTHORED_PROSE_SERVICE_IDS`에 `love-reunion`만 있다.
   그 상품들에서 echo 잠금을 지우면 100% `base-mismatch`로 거부돼 전 요청이 결정론
   fallback으로 떨어진다. **상품별 검증이 열리기 전에 지우지 마라.**

## 5. 명세와 다르게 한 것

- **인라인 `[근거:ID]` 인용을 유지한다.** 명세 §4-3은 구조화 `claimRefs`로 가고 인라인을
  폐기하라고 했지만, 집행 코드(`evaluateGeneratedProse`)는 인라인을 요구한다. 프롬프트를
  명세대로 쓰면 전 필드가 `missing-citation`으로 거부된다. `claimRefs`는 `reunionCopy` 컷에만 쓴다.
- **claim ledger는 축소판이다.** `{claimId, statement}`만 넘긴다. `scope`는 `evidenceIdCatalog`가
  이미 따로 넘기고, `certainty`는 basis의 근거 객체 모양을 종류별로 알아야 해서 넣지 않았다.
  원장은 `id`/`ruleId`를 가진 객체를 만나면 같은 객체의 서술 필드를 가져오는 **모양 불특정
  방식**으로 만든다(최대 400건).
- **`reunionCopy`는 `SajuReportData.reunion`이 있을 때만 활성화된다.** 컷 페이로드를
  리포트에 싣는 배선(`reportBuilder`)은 아직 없다. 스키마·하드스펙·검증·병합은 전부 서 있고
  유닛 테스트로 잠겨 있지만, 배선이 붙기 전에는 프롬프트에 나가지 않는다.

## 6. 되돌리는 방법

세 단계로 나뉘고, 각각 독립적으로 되돌릴 수 있다.

1. **온도만 되돌리기** — `geminiReportService.ts`의 `LOVE_REUNION_TEMPERATURE`를 `0`으로.
   문장 다양성이 사라지지만 구조는 그대로 남는다.
2. **재회운 산문만 다시 잠그기** — `src/lib/saju/promptRelease.ts`의
   `AUTHORED_PROSE_SERVICE_IDS`를 빈 배열로 만든다. **한 곳이면 된다** — 코드 쪽
   `proseGuardModeForServiceId`와 프롬프트 분기가 같은 상수를 읽으므로 두 곳이
   구조적으로 갈라질 수 없다. (1차 해제 때는 가드와 프롬프트가 각자 `serviceId`를
   비교해서 "두 곳을 반드시 같이" 고쳐야 했고, 한쪽만 고치면 모델이 새 문장을 쓰고
   전량 거부되어 전 요청이 fallback으로 떨어지는 — 해제 전보다 나쁜 — 상태가 됐다.
   그 함정을 상수 하나로 없앴다.)
   온도도 같은 파일의 `LOVE_REUNION_PROSE_TEMPERATURE`에 있으므로 함께 확인한다.
   `/health`의 `proseMode`·`proseTemperature`로 롤백이 실제로 배포됐는지 확인할 수 있다.
3. **컷 카피만 끄기** — `buildReunionCopySchema`가 `null`을 돌려주게 하거나,
   `SajuReportData.reunion`을 싣지 않는다. 스키마가 없으면 모델이 그 필드를 만들 수 없고,
   `sanitizeGeminiDraft`가 base 컷 id 집합이 비면 `reunionCopy`를 통째로 버린다.

## 7. 관측

`report.engineMeta.aiFields`가 어느 단계가 막고 있는지 말해 준다.

```
aiFields: {
  mode: 'authored' | 'strict-echo',
  accepted, rejected,
  rejectionsByReason: { 'missing-citation': 3, 'unknown-entity': 1, … },
  cuts?: { accepted, rejected, rejectionsByReason }
}
```

사유 코드는 ASCII로만 짓는다. **이 규약의 근거를 정정한다** — 이 문서의 이전 판과
`report.ts` 주석은 "`findLoveReunionSafetyViolations`가 `engineMeta`를 포함한 리포트 전체를
검사하므로 한국어 사유를 넣으면 가드를 트립시킨다"고 적었는데, 실제 프로덕션 순서에서
그 가드는 `aiFields`를 **절대 보지 않는다.** 주입이 lock·검사가 끝난 뒤이기 때문이다.
규약 자체는 유효하지만 이유가 다르다: **주입 위치가 앞으로 옮겨질 경우를 대비한 계약**이다.
그 계약이 실제로 유효한지는 `geminiGuardContract.test.ts`가 `aiFields`를 붙인 리포트에
`findLoveReunionSafetyViolations`를 실제로 돌려 확인한다.

### 로그

`gemini_draft_review`는 **모든 draft 처리마다 나간다 — 거부 0건과 채택 0건에도.**
이전에는 `if (rejections.length > 0)` 안에서만 자유 문자열 warn이 나갔고, 그래서
(a) authored 모드가 정상 작동 중임을 알리는 신호가 전무했고 (b) 거부율의 **분모**가
어떤 로그에도 없었고 (c) 거부 12건과 140건의 로그 줄이 형태상 구분되지 않았고
(d) 전 필드 거부로 fallback 하는 경로를 가리키는 로그가 아예 없었다.

| 로그 | 형태 | 언제 |
|---|---|---|
| `jsonPayload.event = "gemini_draft_review"` | 구조화 JSON (info) | **모든** draft 처리 |
| `jsonPayload.event = "gemini_draft_all_rejected"` | 구조화 JSON (warn) | 전 필드 거부 → 결정론 착지 |
| `jsonPayload.event = "gemini_merged_rejected"` | 구조화 JSON (warn) | 병합 후 검사가 계열을 되돌림 |
| `Gemini report draft failed:` | 자유 문자열 (error) | 호출 자체 실패 |

구조화 JSON에는 `serviceId` · `reportSerial`(상관 키) · `mode` · `accepted` · `rejected` ·
`rejectionsByReason` · `droppedInSanitize` · `rejectionSample`(최대 12건) ·
`rejectionSampleTruncated`(잘린 건수)가 들어간다. **고객 문장과 개인정보는 넣지 않는다.**

절차와 판단 기준은 `cloudrun-gemini-launch-checklist.md` §7-1에 있다.

## 8. 남은 위험

1. **로컬에서는 제미나이가 호출되지 않는다.** `GEMINI_API_KEY`가 없어 `requestGeminiDraft`가
   즉시 `null`을 돌려준다. 이 단계의 검증은 전부 **모사 픽스처**이고 실제 모델 응답으로는
   한 번도 돌지 않았다. 배포 후 위 로그로 거부율을 먼저 확인해야 한다.
2. **전 필드 거부 시 ledger가 failed로 남는다.** `cloudrun-api`의 `reportService.generatePaid()`가
   `provider === 'deterministic-fallback'`을 503으로 처리한다. 고객은 결정론 리포트를 받지만
   `reportJson` 캐시가 저장되지 않아 같은 결제로 재요청하면 전체가 다시 돌아간다. 해제로
   거부율이 올라가면 이 경로가 먼저 아프다. `provider`에 세 번째 값(`deterministic-verified`)을
   추가하는 것이 다음 수순이고, 계약 변경이라 이번에 손대지 않았다.
3. **엔티티 화이트리스트는 값의 귀속을 보지 못한다.** base가 "목 비중 23.5%"인데 모델이
   "화 비중 23.5%"로 바꿔 써도 집합 소속만 보므로 통과한다. 위치 결속은 claim ledger의
   `claimRefs`가 필드 단위로 들어와야 생긴다. 그래서 **CH02(상대 관련 서술)는 마지막에 연다.**
4. **길이 초과 필드는 `sanitize` 단계에서 사라져 검증 계층에 도달하지 않는다.**
   그래서 `accepted + rejected`는 "모델이 시도한 필드 수"가 아니라 "살아서 검증까지 간
   필드 수"다. 2차 반영에서 폐기 건수를 `aiFields.rejectionsByReason['length-discard']`와
   로그의 `droppedInSanitize`로 내보내 **분모 왜곡은 관측 가능해졌다.** 다만 어느 경로가
   폐기됐는지는 여전히 남지 않는다(`safeText`가 자기 경로를 모른다).

---

## 9. 2차 심사 반영 — 리터럴 표에서 의도 단위 판정으로

1차 해제 뒤 안전성 심사에서 **love-reunion 후보 문장 20건 중 16건이 세 검사표를 모두
통과**한다는 실측이 나왔다. 원인은 규칙이 좁은 리터럴에 묶여 있었다는 것이다 —
`'재회 가능성은 높습니다'`는 잡지만 `'재회 가능성은 거의 확실합니다'`는 통과하고,
`'SNS 스토리'`는 잡지만 `'그 사람이 자주 가던 카페에 같은 시간에 가 보시면'`은 통과했다.
모델이 authored 모드에서 실제로 쓰는 문장이 정확히 그 패러프레이즈다.

### 9-1. 신규 `src/lib/server/reunionIntentGuard.ts` — 아홉 축

리터럴이 아니라 **의도**로 판정한다. 축마다 형태소·구문 패턴군을 갖는다.

| 축 | 막는 것 | 프롬프트 조항 |
|---|---|---|
| `contact-solicitation` | 접촉 권유 (권유 어미 + 접촉 동사) | 차단·거절 시 접촉 금지 |
| `third-party-route` | 공통 지인·다른 번호·새 계정·차단 우회 | 우회 연락 금지 |
| `physical-encounter` | 집 앞·자주 가던 곳·마주침 설계 | 감시 금지 |
| `partner-interior` | 상대 속마음·미래 행동 단정 | 상대 속마음 금지 |
| `unanchored-hope` | 정도 부사 단정·조건부 약속·대기 격려 | 결과 보장 금지 / 근거 없는 희망 금지 |
| `obsession` | 반복 접촉·끝까지 붙잡기 조장 | 집착 조장 금지 |
| `banmal` | 반말 어미 + 2인칭 | 운월 목소리 규격 |
| `age-agnostic-minimum` | 성적 조언·음주·가출·학업 이탈·은폐 | **신규** 연령 무관 최소선 |
| `uncomputed-myeongri` | 계산하지 않는 신살·개념 | **신규** 미계산 개념 금지 |

**절대 검사다 — base 차감을 하지 않는다.** 차감을 두면 base가 어떤 라벨을 한 번
트립하는 순간 그 필드에서 해당 규칙 전체가 조용히 꺼진다(1차 구현의 실제 구멍).
차감이 남은 것은 결정론 카피가 구조적으로 트립하는 세 규칙뿐이다:
`probability`(오행 분포의 `%`) · `age-mention`(대운 구간의 `N세`) · `upsell`(`개운법`).
그 셋도 **조각 단위**로만 차감되므로 같은 규칙의 다른 조각은 그대로 잡힌다.

절대 검사의 대가는 `reunionProseBaseline.test.ts`가 갚는다 — 결정론 리포트 전체에
같은 검사를 6개 밴드로 돌려 0건임을 잠근다. **카피 버그는 프로덕션 500이 아니라
테스트 빨간불로 드러나야 한다.**

### 9-2. 관계 맥락을 서버로 올렸다

프롬프트의 `'When contactStatus is blocked or unknown … never suggest contact'` 조항은
**집행 surface가 아예 없었다** — `contactStatus`가 `src/lib/saju/`와 `src/lib/server/`에
0건이었다. 모델은 차단 여부를 모르는 상태에서 그 조항을 지키라는 요구만 받았다.

이제 `formData.reunionContext`가 세 곳으로 흐른다:
1. **프롬프트** — `buildReunionGuardDirectives`가 관계 상태와 밴드별 금지어를 실어 보낸다.
2. **가드** — `isContactWithheld`가 true면 권유 어미가 없는 허용 서술까지 거부한다.
3. **모드** — 학대 신호가 있으면 `resolveProseGuardMode`가 `strict-echo`로 강등한다.

**둘 중 하나만으로는 안 된다.** 프롬프트는 지킬 수도 안 지킬 수도 있는 요청이고,
코드만 거부하면 모델이 같은 실수를 반복해 거부율만 오른다.

### 9-3. 학대 신호가 있는 독자에게는 산문 권한을 주지 않는다

CH00 게이트(`gate.ts`)는 클라이언트에만 있고 서버는 게이트 판정을 몰랐다. 반면 독자의
자유 서술 **질문**은 프롬프트에 그대로 직렬화돼 나간다 — 즉 `'그 사람이 저를 때렸는데
다시 만나도 될까요'` 같은 질문에 모델이 답을 쓰는 경로가 이미 열려 있었다.

서버에서 `findReunionHarmSignals`를 `breakupReason` · `notes` · **유료 질문**에 돌리고,
신호가 있으면서 `REUNION_SUPPORT_CONTACT`가 `null`인 동안에는 `authored`를 주지 않는다.
감지는 되는데 안내할 곳이 없는 상태에서 가장 위험한 독자에게 가장 검증이 덜 된 문장을
보내는 것이 이 분기의 위험이고, 결정론 계층에는 고정 경계 카피가 있었으므로
이 경로에서 해제하면 **순수하게 나빠진다.** 착지점이 채워지면 이 분기를 다시 검토한다.

### 9-4. 문체 지침을 상품별로 갈랐다

잠금이 살아 있던 동안에는 `FINAL RELEASE-SAFE OVERRIDE`가 문체 지침 전체를 무효화해서
충돌이 드러나지 않았다. 잠금을 걷어낸 순간 같은 요청에 정면으로 모순되는 두 지시가
함께 나가기 시작했다 — `'팩폭 -> 이유 -> 현실 해결책'` · `'NO HEDGING STYLE'` ·
`'capture-worthy line that feels viral'` · `'how the other person reads the customer'`
(= 상대 속마음. 이 상품은 '상대가 느끼는 나' 카드를 **삭제**한다) ·
`'give concrete meeting routes and places'`(= 마주치는 장소 지시) 대(對) 안전 오버라이드의
`'훈계하지 말라'` · `'상대 속마음 금지'` · `'조건과 함께만 쓰라'`.

한 요청에 '팩폭하라'와 '훈계하지 말라'를 같이 보내면 어느 쪽이 이길지 알 수 없고,
온도 0.75에서는 더 그렇다. 재회운은 이제 `LOVE_REUNION_STYLE_DIRECTIVES` 15줄만 받는다
(`'Hedging is correct in this product'` 포함). 다른 상품은 현행 유지다.

### 9-5. 귀속 검사 — 집합 소속이 아니라 '어느 값이 어디에 붙는가'

화이트리스트는 집합 소속만 봤다. 그래서 잠금된 계산값과 **정면으로 모순되는** 문장이
통과했다: 일주 `무자`인데 `'일주는 임자로 읽었습니다'`(임자는 대운표에 있어 집합 통과),
일간 `무`인데 `'일간 병화는'`, 도움 오행 `토·화`인데 `'도움 오행은 수와 금'`,
오행 목=0인데 `'목 기운이 가장 강하고'`. 같은 리포트가 `expert-evidence-v2`의 `무자일주`와
`일주는 임자`를 동시에 실었다.

`findMisattributedClaims`가 귀속 서술어가 붙은 문장만 국지적으로 검사한다 —
`일간` · `일주/월주/년주/시주` · `도움 오행/용신/희신` · `가장 강한/약한` · 십성 강약.
`용신` 단정은 `commercialV2.interpretation.consensus`가 `confirmed`가 아니면 그 자체로
거부한다(프롬프트에만 있고 집행이 없던 규칙).

**이것은 claim ledger의 대체물이 아니다.** 귀속 서술어가 없는 문장은 여전히 검사 대상이
아니고, 위치 결속은 §4-3의 `claimRefs`가 들어와야 생긴다. §8-3이 그대로 유효하다.

### 9-6. 병합 후 검사를 회복 가능하게 만들었다

세 검사를 하나의 try로 감싸 한 건이라도 걸리면 `deterministicResponse()`를 돌려줬다 —
채택된 157개 필드가 **전부** 버려지고 ledger가 failed로 남고 캐시도 안 남았다.
per-field fallback으로 없앴다고 적은 all-or-nothing이 **한 계층 위에 그대로 남아 있었다.**

구체적 방아쇠: `findReportConsistencyViolations`는 `actionPlan.priorities`에 같은 문장이
두 번 있으면 위반을 낸다. authored 모드는 그 배열을 모델에게 열어 준다. 즉 중복 한 줄이
리포트 전체를 버렸다. 온도 0.75에서 더 잘 일어난다.

이제 `runPostMergeGate`가 위반이 지목하는 **필드 계열만** base로 되돌리고 다시 검사한다.
사다리(`actionPlan` → `summary` → `sections` → `questionAnswers` → `keyTakeaways` →
`currentDayun` → `nextDayun` → `heroNote`)를 다 내려가도 통과하지 못하면 그때 결정론으로
착지한다. 되돌린 계열은 `aiFields.revertedFamilies`와 `post-merge-revert` 카운터에 남는다.

검사도 하나 늘렸다 — `findNewReunionProseSafetyFindings`. 기존 `assertLoveReunionReportSafety`는
draft 선검사와 **같은 표**를 써서 순증 방어가 0이었다. 신규 검사는 의도 가드와 밴드별
금지어를 병합된 고객 문장에 **필드 단위로** 한 번 더 건다.

### 9-7. heroNote를 영구 잠금에 넣었다

재회운 heroNote는 리포트 최상단의 **유일한 경계 선언**인데 영구 잠금 목록에도,
`lockCommercialReportFacts`의 복원 목록에도 없었다(`legalNotice`는 있었다).
`Report.tsx`가 `{report.heroNote}`를 그대로 렌더하므로 모델이 쓴 선언이 화면까지 갔다.
이제 `LOVE_REUNION_HERO_NOTE` 상수를 세 곳이 공유한다 — 카피 고정 · 산문 가드 · lock 복원.

### 9-8. 결정론 카피도 자기 안전 규격에 맞췄다

범용 love 섹션은 **새로운 인연**을 전제로 쓰였고 `SNS`를 직업군과 만남 경로로 언급한다.
종합사주에서는 문제가 없지만 재회운에서는 §6-B가 SNS를 전 연령 전면 금지한다.
`applyLoveReunionSafetyContract`가 이제 그 문장만 걷어낸다(카드를 통째로 버리지 않는다 —
`keyTakeaways`의 `인연` 카드는 관계 맥락 문장과 만남 경로 문장이 한 body에 붙어 있다).

### 9-9. 이번에 고치지 않은 것

- **`provider`의 세 번째 값(`deterministic-verified`)** — §8-2가 그대로 유효하다.
  병합 후 all-or-nothing은 §9-6으로 없앴지만 **all-rejected는 남았다.** 다만 그 경로는
  이제 `aiFields`를 싣고 전용 로그(`gemini_draft_all_rejected`)를 남기므로,
  네 가지 실패 원인이 ledger에 같은 문자열로 남던 문제는 해소됐다.
  값 추가는 `cloudrun-api` 계약 변경이라 별도로 다룬다.
- **십성·월 집합 검사** — 결정론 산문이 십성 10개와 월 12개를 정당하게 전부 언급하므로
  집합은 superset이고, 집합 소속 검사는 실효 방어가 아니다. 이것은 "집합은 관대하게"
  원칙의 결과이며 오거부를 막기 위해 필요한 동작이다. 실효 방어는 **귀속 검사**가 한다
  (없는 십성을 강하다고 주장 → 거부). `geminiEntityAttribution.test.ts`가 이 한계를
  명시적으로 고정한다. **관측 보고에 "십성 검사가 막고 있다"고 쓰면 안 된다.**
- **관계 '종류' 토큰** — `합`·`충`·`형`·`파`·`해`·`원진`은 실재 관계에서 집합에 들어오므로
  종류만 말하는 주장(`'천간합을 이루어'`)은 통과한다. 실효 방어는 **완성 라벨형**
  (`갑경충`·`인해합`)이다. 천간 관계도 엔진이 계산하므로(`relations.ts:41-50`)
  전량 금지가 아니라 화이트리스트가 담당한다.
- **`aiReport.ts`의 `degraded`** — per-field fallback 이후 실제 AI 문장 비중을 반영하지
  못한다(157필드 중 1필드만 채택돼도 `provider: 'gemini'`). 화면 계층이라 이번 범위 밖이다.
