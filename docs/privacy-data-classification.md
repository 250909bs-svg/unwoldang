# 개인정보·민감정보 분류와 로깅 정책

## 목적

운월당은 일반 개인정보, 민감한 사주 입력, 결제 식별정보, 공개 상품 정보와 서버 비밀정보를 서로 다른 등급으로 처리한다. 사용자가 브라우저에 보낸 값도 서버 검증 전에는 권위 데이터가 아니며, 로그 또는 관리자 감사 이벤트에 원문을 복사하지 않는다.

## 데이터 등급

### P1 — 일반 개인정보·가명 식별정보

예시:

- `userId`, provider user ID, `ownerUserId`
- 이름, 닉네임, 전체 이메일, avatar URL
- customer key와 계정에 연결 가능한 browser storage key suffix
- IP 주소, user agent 또는 request metadata를 수집하게 되는 경우의 온라인 식별자
- `userBinding`, resource ID hash처럼 다른 데이터와 결합하면 사용자를 추적할 수 있는 가명값

원칙:

- 업무에 필요한 최소 필드만 저장한다.
- 공개 응답이나 관리자 목록에는 목적에 맞는 projection만 제공한다.
- 이메일과 이름은 기본적으로 마스킹하고, 원문 접근은 별도 권한과 감사 이벤트를 요구한다.
- 가명값도 공개 정보로 취급하지 않는다.

### P2 — 민감한 사주·관계 입력과 리포트

예시:

- 생년월일, 출생시간, 음력/양력·윤달 정보, 출생지
- 성별, 관계 상태, 상대방 이름·생년월일·출생시간
- 사용자가 입력한 개인 질문, 고민, 반복 장면, 감정, 관계 맥락
- 사주 원국, 계산 중간값, 분석 payload
- 전체 `reportData`, 질문별 답변 및 개인화된 리포트 문구

원칙:

- 최고 민감도 애플리케이션 데이터로 분류한다.
- request body, debug dump, error object, audit metadata 또는 analytics event에 원문을 남기지 않는다.
- input hash는 중복 방지를 위한 가명 식별값일 뿐 원문을 복원하는 용도로 사용하지 않는다.
- 관리자 API는 실제 업무에 필요한 최소 report projection을 우선하며 전체 원문 접근을 기본값으로 만들지 않는다.

### P3 — 결제·권한 식별정보

예시:

- `orderId`, `paymentId`, `transactionId`, `storeId`
- 금액, 통화, 결제·환불 상태와 시각
- `entitlementId`, `jobId`, `archiveId`
- `orderClaimHash`, payment/user binding
- provider 이름과 결제 method 분류

원칙:

- 카드번호, 계좌번호, CVC, provider access token은 저장하지 않는다.
- 공급자 reconciliation과 권한 복구에 필요한 식별자만 저장한다.
- 다른 사용자 데이터와 결합 가능한 식별자이므로 로그와 공개 URL에 불필요하게 노출하지 않는다.
- 원문 ID가 필요 없는 audit에는 `resourceIdHash`를 사용한다.

### P0 — 공개 가능한 상품 정보

예시:

- 등록된 `productId`
- 표시 이름
- catalog 가격과 `KRW` 통화
- `active`, `draft`, `archived` 상태 중 공개 정책상 노출이 허용된 항목
- 공개 detail URL과 상품 설명

원칙:

- ProductCatalogSnapshot의 공개 projection으로 제공할 수 있다.
- draft의 존재나 내부 출시 metadata는 공개 API가 노출하지 않을 수 있다.
- 공개 정보라도 가격과 상태의 권위는 서버 catalog에 있다.

### S — 서버 전용 비밀·bearer credential

예시:

- `PORTONE_API_SECRET`
- `REPORT_ACCESS_SECRET`, `USER_ACCESS_SECRET`, `ADMIN_ACCESS_SECRET`
- `ADMIN_CREDENTIAL_HASH`와 관리자 ID/password
- `GEMINI_API_KEY`, `KASI_SERVICE_KEY`, `KAKAO_CLIENT_SECRET`
- `FIRESTORE_ACCESS_TOKEN`, metadata service access token
- 사용자 auth token, admin access token, `reportAccessToken`, `orderClaim`
- PortOne login access token과 provider response의 credential

원칙:

- Secret Manager 또는 승인된 runtime secret mechanism에서만 읽는다.
- 프론트 `VITE_*` 변수, Firestore 문서, browser URL, source code, test fixture, 문서 예시에 실제 값을 넣지 않는다.
- bearer 값은 로그, 오류 메시지, audit event, archive JSON에 넣지 않는다.
- signing secret과 credential hash는 서로 다른 용도·값을 사용한다.

## 모델별 분류

| 모델 | 주요 등급 | 비고 |
| --- | --- | --- |
| UserAccount | P1 | 이메일·닉네임·provider identity 포함 가능. auth token은 모델에 저장하지 않음. |
| ProductCatalogSnapshot | P0 | PII 없음. 공개 projection 가능. |
| Order | P1/P3 | owner binding과 거래 정보. intake 원문을 포함하지 않음. |
| Payment | P1/P3 | 공급자 식별·금액·상태. 카드/계좌 원문 금지. |
| Entitlement | P1/P3 | owner와 유료 접근 권한 연결. bearer token 저장 금지. |
| ReportGenerationJob | P1/P2/P3 | inputHash와 권한 연결. 원 입력·질문 원문 및 raw error 저장 금지. |
| ReportArchive | P1/P2/P3 | customerName, reportData, legacy formData를 포함할 수 있어 최고 민감도. |
| AdminAuditEvent | P1/P3 | actorAdminId와 ownerUserId도 가명 PII다. P2와 secret 원문 금지; actor HMAC/pseudonym 방식은 별도 결정한다. |

## 수집·저장 최소화

- UserAccount에는 provider 인증과 사용자 표시·연락에 필요한 최소 필드만 둔다.
- Order와 Payment에 formData, 질문, reportData를 넣지 않는다.
- Entitlement에는 권한 연결과 revoke 상태만 저장한다.
- ReportGenerationJob에는 canonical `inputHash`를 저장하고 민감 입력 전체를 중복 저장하지 않는다.
- ReportArchive는 리포트 재열람에 필요한 데이터이므로 P2 보관소로 취급한다. query 편의를 위해 customerName 또는 질문 원문을 추가로 denormalize하지 않는다.
- AdminAuditEvent에는 request body 또는 response body를 넣지 않는다.

현재 legacy `reportArchives`는 top-level `customerName`과 `entryJson`을 저장하며 `entryJson` 안에 formData/reportData가 포함될 수 있다. 이는 호환 read 대상이지만 신규 schema의 권장 최소화 형태가 아니다. 이번 작업에서는 운영 문서를 rewrite하지 않는다.
`portonePaymentConfirmations`도 `reportJson` cache를 함께 보관하므로 collection 전체를 P2 포함 보관소로 취급한다. 일반 payment 조회 권한만으로 원문 report field를 반환하지 않는다.

## Browser storage 영향

| storage | 민감도 | 현재 위험·정책 |
| --- | --- | --- |
| `unwoldang.auth.user` localStorage | P1/S | email과 user auth token이 지속 저장될 수 있어 XSS 영향이 큼. 이번 작업은 key/카카오 OAuth 방식을 바꾸지 않으며 향후 HttpOnly 또는 짧은 session 방식 검토 필요. |
| `unwoldang.payment.pending` sessionStorage | P2/P3/S | formData, analysis payload, orderClaim, reportAccessToken 포함 가능. 리포트 archive 성공 전 세션 동안 유지됨. 로그·localStorage로 복사 금지. |
| payment entitlement references localStorage | P3 | order/product/createdAt만 최대 20개. bearer token과 intake data 추가 금지. |
| account report archive localStorage | P1/P2/P3 | owner별 key지만 전체 report가 장기 잔존. 정확한 browser 보존 기간과 사용자 삭제 UX 결정 필요. |
| guest report archive sessionStorage | P1/P2/P3 | browser session에 한정. 다른 계정으로 자동 승격 금지. |
| intake draft sessionStorage | P2 | 이름·생년월일·출생시간·질문 포함. session 종료 전 같은 기기 사용자에게 노출될 수 있음. |
| admin access token sessionStorage | S | 만료 확인과 server verification 전 unlock 금지. 로그·localStorage 이동 금지. |

`unwoldang.report.archive` shared legacy key가 현재 reader에서 즉시 삭제되는 문제는 별도 프론트 교차 팀 위험이다. 이 문서는 이를 해결됐다고 주장하지 않는다. 소유권을 확인하지 않은 legacy report를 현재 계정에 자동 연결하는 것도 금지한다.

## 로그 denylist

다음 값은 application log, Cloud Run structured log, browser console, analytics event, exception text, audit metadata에 원문으로 남기지 않는다.

- 이름과 닉네임
- 전체 이메일 주소
- 생년월일
- 출생시간과 출생지
- 상대방의 이름·생년월일·출생시간
- 사용자 질문, 고민, 관계 입력
- formData, analysis payload, reportData 전체 또는 일부 원문
- 사용자 인증 토큰과 admin access token
- `reportAccessToken`
- `orderClaim`
- PortOne API secret/access token과 provider response body
- 관리자 ID/password와 credential hash
- Gemini/KASI/Kakao/Firestore secret 또는 token
- Authorization/Cookie header
- stack trace와 공급자·Firestore 원문 오류

문자열 치환식 redaction에만 의존하지 않는다. logger 입력 자체를 allowlist 구조로 제한하고, unknown object/Error/request body를 logger에 넘기지 않는다.

## 운영 로그 allowlist

필요한 진단 로그는 다음과 같은 비식별·제한 metadata만 사용한다.

- UTC timestamp
- `requestId` 또는 trace ID
- 안정적인 operation/action code
- HTTP status와 안전한 application error code
- duration, retry count, attempt count
- 공개 가능한 `productId`
- provider 이름(`portone`, `gemini` 등)과 성공/실패 분류
- 원문이 아닌 `resourceIdHash` 또는 낮은 cardinality resource type
- lease 획득/충돌 여부 같은 boolean 결과

금액, order/payment/transaction 원문 ID가 반드시 필요한 reconciliation 로그는 일반 application log와 분리된 승인된 접근 경로를 사용하고 보존·열람 정책을 별도로 정한다.

## 안전한 API 오류

- 사용자 응답은 stable code와 일반화된 안전 메시지만 포함한다.
- known validation error도 입력 원문을 message에 echo하지 않는다.
- unknown exception은 `INTERNAL_ERROR`, 의존 서비스 장애는 `SERVICE_UNAVAILABLE`, `DATASTORE_UNAVAILABLE`, `AUTH_PROVIDER_FAILED`, `PAYMENT_PROVIDER_FAILED` 중 하나로 변환한다.
- stack, `cause`, 환경 변수명, Firestore REST error message, PortOne/Gemini/Kakao 원문을 반환하지 않는다.
- 내부 오류와 사용자 입력 오류를 같은 200 응답으로 숨기지 않고 정의된 HTTP status를 사용한다.
- retry 가능한 생성 충돌에는 `Retry-After`와 안전한 retry metadata만 제공한다.

Cloud Run router는 중앙 safe error adapter를 사용하고 5xx payload를 allowlist envelope로 제한한다. PortOne·Firestore 원문은 공개 응답에서 제거하고 Gemini draft 실패는 고정 code만 기록한다. 다만 `src/pages/Loading.tsx`의 browser raw Error log와 `src/lib/server/kasiCalendarService.ts`의 KASI `resultMsg` 전파는 이 작업의 소유 범위 밖 교차 팀 release risk로 남긴다.

## AdminAuditEvent allowlist

감사 이벤트는 누가, 언제, 어떤 리소스에, 어떤 행동을 수행했고 결과가 무엇이었는지만 기록한다.

허용 필드:

- `eventId`
- `actorAdminId` 또는 승인된 actor pseudonym
- `createdAt`, `updatedAt`
- `status`: `succeeded`, `denied`, `failed`
- stable `action`
- `resourceType`
- `resourceIdHash`
- 대상과 관련 있을 때만 `ownerUserId`/`productId`; 가능한 경우 가명화
- `requestId`
- `schemaVersion`, `idempotencyKey`
- allowlist된 metadata: 안전 error code, 변경된 필드 이름 목록, boolean 결과

금지 필드:

- 관리자 password, credential hash, access token
- 사용자 이름, 닉네임, 이메일 원문
- 생년월일, 출생시간, 질문, formData, reportData
- Authorization header, reportAccessToken, orderClaim
- payment/provider response 원문
- request/response body dump
- stack trace, Error object, raw exception message

Audit 문서는 append-only다. audit create 실패를 이유로 민감 request body를 fallback console log에 출력하지 않는다.

## 접근 제어

- 사용자 API는 검증된 user token subject로 owner scope를 만든다. body/query의 owner ID를 신뢰하지 않는다.
- archive ID, order ID 또는 URL만으로 report를 조회할 수 없다.
- archive 저장 entry는 고정 allowlist만 허용하고 `token`, `secret`, `credential`, `password`, `authorization`, `cookie`, `orderClaim` 계열 key를 중첩 위치에서도 거부한다.
- report 저장은 user token과 report token의 userBinding/order/product/entitlement를 대조한다.
- production에서는 report token 검증을 비활성화할 수 없다. `REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=false`는 development 호환에서만 허용된다.
- admin API는 별도 admin signing secret과 server verification을 사용한다.
- 관리자 UI의 local fallback은 localhost 개발 용도다. `VITE_ENABLE_CLIENT_ADMIN`과 공개 client credential hash를 운영 인증으로 사용하지 않는다.
- Firestore는 Cloud Run service account만 접근한다. 사용자/admin bearer는 Firestore credential이 아니다.

## 보존·삭제·익명화

정확한 보존 기간은 아직 승인되지 않았다. ProductCatalogSnapshot은 거래 당시 가격 근거를 위해 무기한 보존하고, 나머지 P1/P2/P3/Audit 데이터는 승인된 retention schedule이 마련되기 전 자동 TTL·삭제를 설정하지 않는다. 코드 metadata의 30일·5년·1년은 검토용 제안이며 활성 정책이 아니다.

정책 결정 시 다음을 모델별로 명시해야 한다.

- 보존 시작점과 기간
- account 탈퇴, 사용자 삭제 요청, 환불 및 분쟁 시 예외
- soft delete와 physical purge의 간격
- backup/export의 잔존 기간
- 삭제 대신 가명화해야 할 거래·감사 필드
- 브라우저 local/session storage 정리 UX
- 관리자·운영자의 삭제 승인 및 audit 절차

이번 작업에서 실제 운영 데이터 삭제, archive purge, user anonymization, TTL 설정을 수행하지 않는다.

## 테스트 기준

- denylist의 고유 marker를 각 입력 필드와 Error/cause에 넣고 log sink에 marker가 없는지 검증한다.
- unknown·Firestore·PortOne·Gemini 오류가 안전 code/message로만 응답되는지 검증한다.
- admin audit serializer가 allowlist 밖 필드를 거부하거나 제거하는지 검증한다.
- 다른 owner의 archive ID/order ID를 제출해도 데이터가 반환되지 않는지 검증한다.
- browser storage contract가 token을 entitlement reference/local archive에 새로 복사하지 않는지 검증한다.
- sample fixture는 development와 명시 opt-in이 모두 참일 때만 활성화되는지 유지한다.
