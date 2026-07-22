# 운월당 데이터·API 계약 v1

## 목적과 적용 범위

이 문서는 운월당의 사용자, 상품 스냅샷, 주문, 결제, 권한, 리포트 생성, 리포트 보관 및 관리자 감사 기록에 대한 서버 권위 계약을 고정한다. UI 상태나 브라우저 route state는 이 계약의 권위 원천이 아니다.

- 공식 `schemaVersion`은 `1`이다.
- 저장 문서에 `schemaVersion`이 없으면 신규 문서가 아니라 legacy source version `0`으로 해석한다.
- 시각은 서버가 생성한 UTC 시각이다. JSON 응답에서는 ISO 8601 문자열, Firestore에서는 timestamp로 저장한다.
- `ownerUserId`는 검증된 사용자 access token의 subject에서 얻는다. 요청 body의 사용자 ID로 덮어쓰지 않는다.
- `userBinding`은 서버 비밀키로 사용자와 결제·권한을 결합한 불투명 값이다. 클라이언트가 생성하거나 변경할 수 없다.
- `idempotencyKey`는 서버가 operation, owner, resource 및 검증된 payload에 묶어 해석한다. 클라이언트가 같은 문자열을 보냈다는 이유만으로 다른 사용자나 다른 payload의 결과를 재사용하지 않는다.
- 아래에서 `정책 승인 전 자동 삭제 없음`이라고 적은 데이터에는 이번 작업에서 TTL, 일괄 삭제 또는 익명화를 설정하지 않는다. 정확한 기간은 법무·사업·보안 담당자가 별도로 승인해야 한다.

## 상품 계약

### 상태 의미

| 상태 | 신규 입력 | 신규 주문 | 기존 결제 확인 | entitlement 복구 | 과거 리포트 재열람 |
| --- | --- | --- | --- | --- | --- |
| `active` | 허용 | 허용 | 허용 | 허용 | 허용 |
| `draft` | 차단 | 차단 | 접근 대상에서 제외 | 접근 대상에서 제외 | 접근 대상에서 제외 |
| `archived` | 차단 | 차단 | 허용 | 허용 | 허용 |
| unknown | 차단 | 차단 | 차단 | 차단 | 차단 |

`draft`와 unknown 상품은 URL, 클라이언트 state 또는 저장된 참조가 있더라도 유료 데이터 접근 권한을 만들지 않는다. `archived` 예외는 이미 서버에서 확인된 결제·권한·완료 리포트에만 적용한다. 기존 완료 cache/archive의 재열람은 허용하지만 새 `ReportGenerationJob` 또는 AI provider 호출은 시작하지 않는다.

### 고정 상품 카탈로그

표시 이름과 가격은 현재 `main`의 계약값이며 이 작업에서 변경하지 않는다. 통화는 모두 `KRW`다.

| 상태 | productId | 표시 이름 | 가격 |
| --- | --- | --- | ---: |
| active | `general-signature` | 운월선생 정통 종합사주 | 79,000 |
| active | `past-life-goblin` | MZ 도깨비 전생사주 | 49,000 |
| active | `love-reading` | MZ무당 팩폭 연애운 | 49,000 |
| active | `love-reunion` | 홍연아씨 재회 가능성 | 55,000 |
| active | `match-couple` | 월연도령 사주궁합 | 69,000 |
| archived | `life-flow` | 운월선생 신년운세 | 59,000 |
| archived | `concern-reading` | 운월당 고민풀이 | 2,900 |
| archived | `match-destiny` | 월연도령 운명 궁합 | 63,000 |
| archived | `marriage-blueprint` | 청연부인 결혼운 설계도 | 72,000 |
| archived | `marriage-timing` | 청연부인 혼인 시기 리포트 | 58,000 |
| archived | `career-reading` | 운월선생 직업운 설계도 | 59,000 |
| archived | `money-reading` | 운월선생 금전운 설계도 | 59,000 |

## 공통 필드

모든 공식 모델은 다음 필드를 갖는다.

| 필드 | 계약 |
| --- | --- |
| `schemaVersion` | 정수 `1`. 서버 권위이며 클라이언트가 결정하지 않는다. |
| `createdAt` | 최초 생성 시 서버 UTC 시각. 이후 변경 금지. |
| `updatedAt` | 성공한 서버 변경 시 갱신되는 UTC 시각. |
| `idempotencyKey` | 서버가 namespace와 owner/payload를 검증한 불투명 키. 모델에 따라 deterministic resource key일 수 있다. |

`DATA_MODEL_METADATA.retention.period`의 30일·5년·1년 값은 검토용 제안이며 운영 TTL이 아니다. 법무·운영 승인 전에는 ProductCatalogSnapshot 외 어떤 모델에도 자동 삭제를 켜지 않는다.

## 공식 모델

### 1. UserAccount

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `userId`. 검증된 인증 provider subject에 대응하는 서버 권위의 불투명 문자열이다. 기존 카카오 사용자 ID 형식을 다시 쓰지 않는다. |
| 소유자·상품 | `ownerUserId === userId`, `productId: null`. |
| 필수 필드 | 공통 필드, `userId`, `ownerUserId`, `productId`, `provider`, `providerUserId`, `status`, `lastAuthenticatedAt`. |
| 선택 필드 | `nickname`, `email`, `avatarUrl`. |
| 상태 | `active`, `disabled`, `anonymized`. `anonymized`에서 다시 `active`로 복구하지 않는다. |
| 서버 권위 | ID, provider binding, 상태, 모든 시각, schema version, idempotency key. |
| 클라이언트 입력 | 인증 교환에 필요한 authorization code와 검증 가능한 redirect URI. 프로필 값은 provider 응답에서만 채택한다. |
| 클라이언트 금지 | `userId`, `providerUserId`, `ownerUserId`, 상태, 이메일 검증 여부, 시각을 직접 지정하는 행위. |
| 개인정보 | 있음: 사용자 식별자, 닉네임, 이메일, avatar URL. 인증 토큰은 UserAccount 문서 필드가 아니다. |
| 보존 기간 | 계정 및 관련 구매 복구 정책과 함께 결정해야 한다. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | 운영 삭제를 이 작업에서 수행하지 않는다. 승인된 익명화 시 provider 식별자·닉네임·이메일·avatar를 제거/대체하고 `anonymized`로 전이하되 법적 보존 대상 거래 참조는 가명 ID로 유지한다. |
| idempotency | `(provider, providerUserId)` 조합을 서버가 동일 계정으로 투영한다. |
| 인덱스 | deterministic ID를 쓰면 별도 uniqueness query가 필요 없다. provider lookup을 쿼리로 구현할 경우 `(provider ASC, providerUserId ASC)`를 planned index로 관리한다. |

### 2. ProductCatalogSnapshot

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `catalogHash = sha256(canonical ordered products)`이고, `catalogSnapshotId = sha256("unwoldang:product-catalog-snapshot:v1:" + catalogHash + ":" + effectiveAt)`인 lowercase SHA-256이다. |
| 소유자·상품 | `ownerUserId: null`, `productId: null`. |
| 필수 필드 | 공통 필드, `catalogSnapshotId`, `ownerUserId`, `productId`, `status`, `effectiveAt`, `products`, `catalogHash`. |
| 상품 항목 | `productId`, `displayName`, `amount`, `currency`, `status(active|draft|archived)`. |
| 상태 | `current`, `superseded`. 동시에 current인 snapshot을 둘 이상 만들지 않는다. |
| 검증 | 새 `current` snapshot은 현재 서버의 12개 ID·표시 이름·금액·상태와 일치해야 한다. `superseded` snapshot은 한 개 이상의 상품과 중복 없는 알려진 ID를 요구하되, 나중에 추가된 상품은 생략할 수 있고 과거 이름·금액·상태를 현재 값으로 덮지 않는다. 과거 버전별 정확한 필수 ID 집합은 snapshot 원본을 보존해 판단한다. |
| 서버 권위 | 전체 문서. 상품 registry와 배포된 서버 가격표에서만 생성한다. |
| 클라이언트 입력 | 없음. 공개 조회만 가능하다. |
| 클라이언트 금지 | 가격, 통화, 상품 상태, hash, 효력 시각을 선택하는 행위. |
| 개인정보 | 없음. 공개 가능한 상품 계약 정보다. |
| 보존 기간 | 주문·결제 당시 가격 근거를 재현하기 위해 무기한 보존한다. 자동 TTL 없음. |
| 삭제·익명화 | PII가 없으므로 익명화 대상이 아니다. 참조 중인 snapshot은 삭제하지 않는다. |
| idempotency | 동일한 `catalogHash`와 `effectiveAt`은 동일 snapshot 생성 요청으로 취급한다. |
| 인덱스 | planned: `(status ASC, effectiveAt DESC)`. |

### 3. Order

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `orderId`. 기존 형식 `^UW-[A-Za-z0-9._-]{12,116}$`을 유지한다. |
| 소유자·상품 | `ownerUserId`, `userBinding`, 고정된 `productId`. |
| 필수 필드 | 공통 필드, `orderId`, `ownerUserId`, `userBinding`, `productId`, `catalogSnapshotId`, `amount`, `currency`, `status`. |
| 상태별 시각 | `paidAt`, `failedAt`, `cancelledAt`, `refundedAt` 중 해당 상태에 맞는 값만 서버가 기록한다. |
| 상태 | `created`, `pending`, `paid`, `failed`, `cancelled`, `refunded`. |
| 서버 권위 | owner/binding, 상품 snapshot, 가격·통화, 상태와 전이 시각. |
| 클라이언트 입력 | `productId`, 호환 facade의 선택적 기존 `orderId`; 클라이언트 `amount`는 비교용 힌트일 뿐 권위값이 아니다. |
| 클라이언트 금지 | 가격, 통화, owner, paid/refunded 상태, 상태 시각, snapshot을 결정하는 행위. |
| 개인정보 | 직접 PII는 최소화한다. owner 식별자와 userBinding은 가명 식별정보이며 결제 식별정보로 분류한다. |
| 보존 기간 | 거래 보존 정책 결정 필요. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | 주문 원장 삭제 금지. 승인된 계정 익명화 시 owner를 가명화하되 금액·상태·상품·감사 연결은 유지한다. |
| idempotency | 기존 `orderId`가 주문 생성 key다. signed `orderClaim`이 owner, product, 서버 가격을 결합하며 동일 `orderId`의 다른 binding은 `409`다. |
| 인덱스 | planned: `(ownerUserId ASC, createdAt DESC)`, `(ownerUserId ASC, status ASC, createdAt DESC)`. |

### 4. Payment

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `paymentId`. 공급자가 반환한 기존 payment ID 문자열을 유지한다. Firestore 내부 legacy document ID는 `sha256("portone:" + paymentId)`다. |
| 소유자·상품 | `orderId`, `ownerUserId`, `userBinding`, `productId`. |
| 필수 필드 | 공통 필드, `paymentId`, `orderId`, `ownerUserId`, `userBinding`, `productId`, `amount`, `currency`, `storeId`, `transactionId`, `provider`, `status`. |
| 상태별 시각 | `approvedAt`, `confirmedAt`, `refundedAt`. |
| 상태 | `pending`, `paid`, `failed`, `cancelled`, `refunded`. |
| 서버 권위 | 공급자 조회 결과, 주문·owner binding, amount/currency/store/transaction, 상태와 시각. |
| 클라이언트 입력 | 확인을 위한 `paymentId`, `txId?`, `orderId`, `productId`, `amount`, `orderClaim`. 모두 서버·공급자 값과 재검증한다. |
| 클라이언트 금지 | 공급자 결과, paid/refunded 상태, 실제 금액, store ID, transaction ID 또는 승인 시각을 확정하는 행위. |
| 개인정보 | 결제 식별정보와 가명 owner binding 포함. 카드번호·계좌번호·PortOne API secret은 저장하지 않는다. |
| 보존 기간 | 거래 보존 정책 결정 필요. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | 실제 결제 원장은 삭제하지 않는다. 승인된 익명화는 직접 PII를 제거하되 공급자 reconciliation 식별자는 유지한다. |
| idempotency | provider와 `paymentId`가 결제 확인의 고유 key다. 동일 결제 재확인은 같은 canonical 결과를 반환하고 두 번째 entitlement를 만들지 않는다. |
| 인덱스 | planned: `(ownerUserId ASC, confirmedAt DESC)`. `orderId`/`transactionId` lookup은 필요 시 단일 필드 index를 사용한다. |

### 5. Entitlement

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `entitlementId`. 서버가 결제에 결합해 발급한 불투명 ID다. legacy ledger에서는 기존 entitlement ID를 그대로 투영한다. |
| 소유자·상품 | `paymentId`, `orderId`, `productId`, `ownerUserId`, `userBinding`. |
| 필수 필드 | 공통 필드, 위 연결 필드, `status`, `issuedAt`. |
| 선택 필드 | `revokedAt`, `revocationReason`. |
| 상태 | `active`, `revoked`. `revoked -> active`는 새 정책 승인 없이 허용하지 않는다. |
| 서버 권위 | 결제 연결, owner/binding, 상품, 발급·취소 상태와 사유. |
| 클라이언트 입력 | 목록 조회는 body 없음, 갱신은 `orderId`만 허용한다. 갱신은 새 권한 생성이 아니라 짧은 수명의 report access token 재발급이다. |
| 클라이언트 금지 | active 발급, owner/product/order 변경, revoked 복구, revoke 사유·시각 결정. |
| 개인정보 | 가명 owner/binding과 결제·권한 식별정보. |
| 보존 기간 | 구매 복구와 리포트 접근 정책 결정 필요. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | 결제 추적성을 유지하며 owner만 승인된 방식으로 가명화한다. |
| idempotency | 하나의 paid payment에 하나의 entitlement. 동일 확인 retry는 기존 entitlement를 재사용한다. |
| 인덱스 | planned: `(ownerUserId ASC, status ASC, issuedAt DESC)`. |

활성 entitlement 발급 전제는 연결된 `Payment.status === "paid"`다. pending/failed/cancelled/refunded 결제에는 새 active entitlement를 발급할 수 없다.

환불 정책은 아직 확정되지 않았다. Payment가 `refunded`가 되면 v1 계약은 다음만 강제한다.

1. 새 entitlement 발급 및 비활성 entitlement의 active 전환을 차단한다.
2. 기존 active entitlement를 자동 revoke하거나 자동 유지로 결정하지 않는다.
3. 정책 결정이 필요하다는 결과와 관리자 감사 이벤트를 남길 수 있으나, 승인된 명령 전에는 entitlement를 자동 변경하지 않는다.

### 6. ReportGenerationJob

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `jobId = sha256("unwoldang:report-job:v1:" + entitlementId)`. entitlement마다 하나이며 최초 `inputHash`를 불변으로 고정한다. operation idempotency key는 별도 `sha256("unwoldang:report-generation:v1:" + entitlementId + ":" + inputHash)`다. |
| 소유자·상품 | `orderId`, `entitlementId`, `productId`, `ownerUserId`, `userBinding`. |
| 필수 필드 | 공통 필드, 위 연결 필드, `inputHash`, `status`, `attemptCount`. |
| 선택 필드 | `provider`, `leaseId`, `leaseExpiresAt`, `startedAt`, `completedAt`, `failedAt`, `cancelledAt`, `errorCode`. |
| 상태 | `queued`, `generating`, `completed`, `failed`, `cancelled`. |
| 서버 권위 | entitlement binding, canonical input hash, 상태/attempt/lease/provider/error code/시각. |
| 클라이언트 입력 | 검증 가능한 리포트 입력과 `orderId`; report access token은 인증 수단이며 저장 모델 필드가 아니다. |
| 클라이언트 금지 | `inputHash`, owner/entitlement/product, attempt, provider, 상태·lease·완료 결과를 결정하는 행위. |
| 개인정보 | inputHash 자체는 가명값이지만 원 입력은 민감한 사주 입력이다. 오류에는 입력 원문을 넣지 않는다. |
| 보존 기간 | 생성 추적·장애 대응 기간 결정 필요. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | 원 입력을 job 문서에 중복 저장하지 않는다. 승인된 정리 시 식별 가능한 owner를 가명화하고 최소 상태 메타데이터만 유지한다. |
| idempotency | `(entitlementId, inputHash)`는 단 하나의 논리 작업이다. 같은 조합의 completed 결과는 재사용하고, 진행 중이면 stable in-progress 오류를 반환한다. |
| 인덱스 | uniqueness는 deterministic job ID/transaction으로 보장한다. planned 운영 조회: `(status ASC, leaseExpiresAt ASC)`, `(ownerUserId ASC, status ASC, updatedAt DESC)`. |

한 entitlement에 최초로 결합된 `inputHash`와 다른 hash를 제출하면 `REPORT_INPUT_CONFLICT`로 차단한다. retry는 같은 입력만 허용한다.

### 7. ReportArchive

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `archiveId`. 기존 클라이언트는 `${productId}:${orderId}`를 사용한다. legacy Firestore document ID는 `sha256(userId + ":" + archiveId)`다. |
| 소유자·상품 | `orderId`, `entitlementId`, `productId`, `ownerUserId`, `userBinding`. legacy v0 projection에서 일부 연결값은 `null`일 수 있다. |
| 필수 필드 | 공통 필드, 위 연결 필드, `status`, `reportData`, `reportProvider`, `reportVersion`. 신규 v1 write는 모든 소유·권한 연결을 요구한다. |
| 상태 | `available`, `deleted`. `deleted` 문서는 일반 사용자 조회 결과에서 제외한다. |
| 서버 권위 | owner/binding/order/entitlement/product, 상태, provider/version 및 시각. 기존 facade의 reportData는 token identity와 허용 필드 검증 뒤 받으며, 서버 cache 원본과의 byte-level 대조는 아직 하지 않는다. |
| 클라이언트 입력 | 기존 facade의 `{ entry, reportAccessToken }`. 운영에서는 `reportAccessToken`이 필수다. `entry`는 고정 allowlist만 허용하고 bearer/secret 계열 key는 중첩 위치에서도 거부하며 archive ID·order·product를 서버 토큰과 대조한다. |
| 클라이언트 금지 | 다른 owner 지정, URL/ID만 바꾸어 조회, entitlement/order/product binding 변경, 삭제 상태 결정. |
| 개인정보 | 있음: customer name, 사주 입력 파생값, 질문에 대한 답과 전체 reportData. 최고 민감도로 취급한다. |
| 보존 기간 | 유료 재열람과 사용자 삭제 정책 결정 필요. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | 이 작업에서 실제 삭제하지 않는다. 향후 soft delete 후 승인된 purge를 분리하고, 거래 원장과 감사 기록은 보존한다. |
| idempotency | 같은 owner의 같은 `archiveId` upsert만 허용하며 다른 order/product payload 충돌은 거부한다. |
| 인덱스 | current legacy query는 `userId ==` 단일 필드. planned canonical query는 `(ownerUserId ASC, createdAt DESC)`, `(ownerUserId ASC, status ASC, createdAt DESC)`, `(ownerUserId ASC, productId ASC, createdAt DESC)`. |

서버 조회는 인증된 `ownerUserId`를 항상 조건으로 사용한다. archive ID 또는 URL을 아는 것만으로 조회할 수 없다. `archived` 상품의 기존 archive는 허용하고, `draft`와 unknown 상품은 제외한다.

동일 archive document를 저장할 때 서버는 먼저 기존 owner/order/product binding을 읽어 충돌을 거부한다. 신규 생성은 `exists=false`, 갱신은 읽은 `updateTime` precondition으로 경쟁 쓰기를 막는다. 개발 환경에서만 명시적인 `REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=false` 호환 옵션을 쓸 수 있으며 production에서는 이 우회를 구성 오류로 차단한다.

### 8. AdminAuditEvent

| 항목 | 계약 |
| --- | --- |
| 고유 ID | `eventId`. 서버가 발급한 시간 순서 보존 불투명 ID다. |
| 소유자·상품 | `ownerUserId`와 `productId`는 대상 리소스에 해당할 때만 값이 있고 아니면 `null`이다. |
| 필수 필드 | 공통 필드, `eventId`, `actorAdminId`, `ownerUserId`, `productId`, `status`, `action`, `resourceType`, `requestId`. |
| 선택 필드 | `resourceIdHash`, 안전한 `metadata`. |
| 상태 | `succeeded`, `denied`, `failed`. 이벤트는 append-only이며 상태를 전이하지 않는다. |
| 서버 권위 | 전체 문서. 검증된 admin token과 서버 처리 결과에서만 생성한다. |
| 클라이언트 입력 | 관리 작업 자체의 허용된 request fields. audit 필드는 직접 받지 않는다. |
| 클라이언트 금지 | actor, 결과, 대상 hash, 시각, metadata를 작성·수정·삭제하는 행위. |
| 개인정보 | actor 및 대상의 가명 식별정보가 있을 수 있다. 이름·이메일·사주 입력·리포트 원문은 금지한다. |
| 보존 기간 | 보안·감사 보존 기간 결정 필요. 정책 승인 전 자동 TTL·삭제 없음. |
| 삭제·익명화 | append-only. 승인된 보존 만료 전 수정/삭제 금지; owner 삭제 시 직접 식별자 대신 hash만 유지하는 방식을 별도 승인한다. |
| idempotency | `(requestId, action, resourceType, resourceIdHash-or-none)`의 동일 처리 결과는 중복 audit 생성을 방지한다. |
| 인덱스 | planned: `(actorAdminId ASC, createdAt DESC)`, `(resourceType ASC, resourceIdHash ASC, createdAt DESC)`, `(action ASC, createdAt DESC)`. |

## Order 상태 전이

Order 전이는 서버의 payment/order service만 수행한다.

```text
created -> pending
pending -> paid
pending -> failed
pending -> cancelled
paid -> refunded
```

그 밖의 전이는 모두 금지한다. 특히 다음은 반드시 테스트한다.

- `failed -> paid`
- `cancelled -> paid`
- `refunded -> paid`
- `paid -> pending`
- terminal 상태에서 임의 상태로의 재진입

동일 상태를 다시 기록하는 요청은 새로운 상태 전이가 아니다. idempotency 검증을 통과한 동일 operation retry만 현재 결과를 반환하며 상태 시각을 다시 쓰지 않는다.

Payment는 `pending -> paid|failed|cancelled`, `paid -> refunded`만 허용한다. Order와 Payment가 불일치하면 서버는 entitlement 또는 report 권한을 발급하지 않고 reconciliation 대상으로 분류한다.

그 밖의 mutable model 전이는 다음과 같다. 같은 상태 retry는 idempotency 검증 후 no-op이며 새 edge가 아니다.

- UserAccount: `active -> disabled|anonymized`, `disabled -> active|anonymized`; `anonymized`는 terminal.
- ProductCatalogSnapshot: `current -> superseded`; `superseded`는 terminal.
- Entitlement: `active -> revoked`; `revoked -> active` 금지.
- ReportGenerationJob: `queued -> generating|cancelled`, `generating -> completed|failed|cancelled`, `failed -> generating|cancelled`; completed/cancelled는 terminal.
- ReportArchive: `available -> deleted`; deleted는 일반 조회에서 제외하고 자동 복구하지 않는다.

각 상태와 모순되는 terminal timestamp, active entitlement의 revoke 필드, anonymized 계정의 nickname/email/avatar는 validator가 거부한다.

## API 계약

### 기존 경로와 호환 facade

다음 `/api/*` 경로를 유지한다. router는 표의 각 경로에서 `/api`를 뺀 bare path도 compatibility alias로 유지하며, `/report` 역시 `/api/report`와 동일하다.

| 기능 | 메서드·경로 | 클라이언트 요청 | 서버 성공 응답의 핵심 |
| --- | --- | --- | --- |
| 사용자 인증 | `POST /api/auth/kakao/exchange` | authorization code, 검증 가능한 redirect URI | 사용자 access token과 provider 기반 사용자 정보 |
| 주문 생성 | `POST /api/payments/portone/order` | `productId`, optional 기존 `orderId`/비권위 `amount` | 서버 `orderId`, catalog `amount`, `currency`, user-bound `orderClaim`, expiry |
| 결제 확인 | `POST /api/payments/portone/confirm` | `paymentId`, `txId?`, `orderId`, `productId`, `amount`, `orderClaim` | 검증된 payment/entitlement 참조와 짧은 수명의 `reportAccessToken` |
| entitlement 목록 | `GET /api/payments/portone/entitlements` | 사용자 bearer token | `{ entitlements: [...] }` |
| entitlement 갱신 | `POST /api/payments/portone/entitlement/renew` | `{ orderId }`와 사용자 bearer token | 동일 entitlement에 대한 새 report access token |
| 리포트 생성 | `POST /api/report`, `POST /report` | verified report input, order ID, report bearer token | provider, mode/version 및 report data |
| 리포트 저장 | `POST /api/archive/reports` | `{ entry, reportAccessToken }`와 사용자 bearer token | `{ ok: true, entry }` compatibility shape |
| 리포트 목록 | `GET /api/archive/reports` | 사용자 bearer token | `{ entries, storage }` |
| 관리자 로그인 | `POST /api/admin/login` | `{ adminId, password }` | `{ adminAccessToken, expiresInMs? }` |
| 관리자 데이터 조회 | `GET /api/admin/reports` | admin bearer token | `{ entries, storage }` |

`Authorization`, `reportAccessToken`, `orderClaim`은 인증 수단이지 데이터 모델의 일반 응답 필드가 아니다. 목록 응답이나 audit metadata에 포함하지 않는다.

### HTTP 상태와 안정 오류 코드

기존 UI가 읽는 `{ message }` facade는 유지하고 모든 오류 응답에 안정적인 `code`를 함께 제공한다. 사용자 메시지에는 stack, 내부 예외, 환경 변수명, Firestore/PortOne/Gemini 원문을 넣지 않는다. 5xx 응답은 `code`와 일반화 메시지만 남기고 추가 필드를 제거한다.

| HTTP | 대표 코드 | 의미 |
| ---: | --- | --- |
| 400/422 | `REQUEST_INVALID` | 요청 schema 또는 도메인 입력이 잘못됨 |
| 401 | `AUTH_REQUIRED` | 인증 없음·만료·검증 실패 |
| 403 | `ACCESS_DENIED` | 인증 주체가 작업 권한 없음 |
| 404 | `RESOURCE_NOT_FOUND`, `UNSUPPORTED_ROUTE` | owner 범위의 리소스 없음 또는 미지원 경로 |
| 409/412 | `STATE_CONFLICT`, `REPORT_INPUT_CONFLICT`, `REPORT_GENERATION_IN_PROGRESS`, `REFUND_ENTITLEMENT_POLICY_DECISION_REQUIRED` | 상태·입력·중복·미확정 정책 충돌 |
| 413 | `PAYLOAD_TOO_LARGE` | 크기 제한 초과 |
| 429 | `RATE_LIMITED` | 요청 제한 초과 |
| 502/503/504 | `SERVICE_UNAVAILABLE`, `DATASTORE_UNAVAILABLE`, `AUTH_PROVIDER_FAILED`, `PAYMENT_PROVIDER_FAILED` | 의존 저장소·공급자 장애 |
| 500 | `INTERNAL_ERROR` | 사용자에게 세부 내용을 숨기는 내부 오류 |

`REPORT_GENERATION_IN_PROGRESS`는 `Retry-After`와 안전한 retry metadata만 제공한다. 공급자 원문은 응답의 `message`, `details`, `cause`에 넣지 않는다.

## 필수 불변조건과 테스트 기준

- 유효·무효 Order 전이를 모두 테스트한다.
- Payment가 paid가 아니면 active Entitlement 발급을 거부한다.
- refunded Payment에서 새 발급을 막고 기존 Entitlement는 자동 변경하지 않는 decision-required 계약을 테스트한다.
- 동일 entitlement와 inputHash는 하나의 job/result만 만들고, 다른 hash는 차단한다.
- archive 조회는 인증 owner 조건을 생략할 수 없으며 다른 사용자 ID/URL 변조를 차단한다.
- active/draft/archived/unknown 상품 정책과 고정 상품 가격을 테스트한다.
- archived legacy report 복구와 schemaVersion 없는 v0 adapter를 테스트한다.
- 내부·공급자 오류가 안전 코드/메시지로 변환되는지 테스트한다.
- 로그 금지값이 logger 또는 console sink에 나타나지 않는지 테스트한다.
