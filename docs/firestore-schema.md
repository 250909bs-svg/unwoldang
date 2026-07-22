# Firestore 컬렉션·저장소 계약

## 범위

이 문서는 현재 운영 호환 컬렉션과 v1 공식 컬렉션·repository 경계를 구분한다. 이번 작업은 collection 생성, composite index 배포, TTL 설정, 운영 문서 rewrite 또는 일괄 migration을 수행하지 않는다.

Firestore 접근 주체는 Cloud Run runtime service account다. 브라우저, 일반 사용자, 관리자 UI는 Firestore를 직접 읽거나 쓰지 않고 인증된 Cloud Run API만 사용한다. 저장소에 Firebase client rules나 `firestore.indexes.json`은 현재 존재하지 않는다.

## 중앙 collection 이름

| 논리 모델 | collection 이름 | 상태 |
| --- | --- | --- |
| UserAccount | `users` | v1 planned |
| ProductCatalogSnapshot | `productCatalogSnapshots` | v1 planned |
| Order | `orders` | v1 planned |
| Payment | `payments` | v1 planned; legacy payment ledger 유지 |
| Entitlement | `entitlements` | v1 planned; legacy payment ledger projection 유지 |
| ReportGenerationJob | `reportGenerationJobs` | v1 planned; legacy payment ledger projection 유지 |
| ReportArchive | `reportArchives` | 현재 운영 이름 유지, v1 adapter 적용 |
| AdminAuditEvent | `adminAuditEvents` | v1 planned |
| legacy payment ledger | `portonePaymentConfirmations` | current, 변경·삭제 금지 |

`portonePaymentConfirmations`의 실제 이름은 `PORTONE_PAYMENT_LEDGER_COLLECTION`, `reportArchives`의 실제 이름은 `FIRESTORE_ARCHIVE_COLLECTION`으로 재정의될 수 있다. 새 v1 이름도 각각 `FIRESTORE_USERS_COLLECTION`, `FIRESTORE_PRODUCT_CATALOG_SNAPSHOTS_COLLECTION`, `FIRESTORE_ORDERS_COLLECTION`, `FIRESTORE_PAYMENTS_COLLECTION`, `FIRESTORE_ENTITLEMENTS_COLLECTION`, `FIRESTORE_REPORT_GENERATION_JOBS_COLLECTION`, `FIRESTORE_ADMIN_AUDIT_EVENTS_COLLECTION`으로 override할 수 있다.

`resolveFirestoreCollections()`가 기본값과 override의 단일 해석기다. `createDataMigrationRegistry(resolvedCollections)`에도 같은 resolved 값을 전달해야 실제 배포 source/target을 정확히 설명한다.

## 현재 운영 구조

### `portonePaymentConfirmations`

- document ID: lowercase SHA-256 `sha256("portone:" + paymentId)`
- 읽기·쓰기: Cloud Run payment/report service account
- 생성: 결제 확인 시 create-only 시도 후 동일 document 충돌을 idempotent confirmation으로 검사
- 사용자 목록: `userId EQUAL` query, 최대 100
- 역할: Payment, Entitlement, ReportGenerationJob 및 completed report cache가 한 문서에 결합된 legacy ledger

현재 필드:

| 필드 | Firestore 값 | 설명 |
| --- | --- | --- |
| `paymentId`, `orderId`, `productId` | string | 공급자 결제·주문·상품 식별자 |
| `amount` | integer | 서버가 검증한 KRW 금액 |
| `currency`, `storeId`, `transactionId` | string | 공급자 검증 결과 |
| `confirmedAt` | timestamp | 결제 확인 시각 |
| `userId`, `userBinding` | string | owner와 서버 생성 binding |
| `entitlementId`, `entitlementStatus` | string | 결제에 포함된 legacy entitlement |
| `entitlementCreatedAt` | timestamp | 권한 발급 시각 |
| `orderClaimHash` | string | 원문 claim이 아닌 SHA-256 |
| `reportInputHash` | string | entitlement에 최초 결합된 입력 hash |
| `reportGenerationStatus` | string | legacy generation 상태 |
| `reportGenerationLockId` | string | lease 식별자 |
| `reportGenerationLockExpiresAt` | timestamp | lease 만료 시각 |
| `reportGenerationStartedAt` | timestamp | 시작 시각 |
| `reportGenerationAttempt` | integer | 시도 횟수 |
| `reportGenerationCompletedAt`, `reportGenerationFailedAt` | timestamp | 완료·실패 시각 |
| `reportGenerationFailure` | string | legacy 실패 문자열; 신규 계약에서는 안전한 error code만 허용해야 함 |
| `reportJson`, `reportJsonHash` | string | 완료된 리포트 cache와 무결성 hash |

Firestore의 document `createTime`과 `updateTime`도 legacy adapter가 읽는다. 문서에 `schemaVersion`이 없으므로 source version `0`이다. 기존 운영 write path와 필드명은 변경하지 않는다.

`legacyPaymentLedgerAdapter`는 이 문서를 v1 Payment, Entitlement 및 ReportGenerationJob view로 순수 투영한다. adapter는 legacy 문서에 `schemaVersion`을 쓰거나 필드를 이동·삭제하지 않는다.

### `reportArchives`

- document ID: lowercase SHA-256 `sha256(userId + ":" + archiveId)`
- 읽기·쓰기: Cloud Run archive service account
- 사용자 목록: 인증 token에서 얻은 `userId EQUAL` query
- 관리자 목록: 검증된 admin API가 service account로만 조회
- 브라우저가 document ID 또는 URL을 바꾸어 직접 조회하는 경로는 없음

현재 top-level 필드:

| 필드 | Firestore 값 | 설명 |
| --- | --- | --- |
| `userId` | string | 현재 owner query key |
| `archiveId` | string | 기존 archive entry ID |
| `orderId` | string | 오래된 entry에서는 빈 문자열일 수 있음 |
| `productId` | string | 기존 상품 ID |
| `customerName` | string | PII; 신규 query key로 사용 금지 |
| `title` | string | 리포트 제목 |
| `paymentMethod` | string | legacy 표시 정보 |
| `createdAt` | timestamp | archive 생성 시각 |
| `entryJson` | string | 기존 `ReportArchiveEntry` 전체 JSON; formData와 reportData를 포함할 수 있음 |

문서에 `schemaVersion`, `entitlementId`, `userBinding`, `reportVersion`, explicit `updatedAt`이 없을 수 있다. 이 경우 source version `0`으로 읽는다.

`legacyReportArchiveAdapter`는 `entryJson`을 파싱하고 top-level `userId`를 owner 권위값으로 사용해 canonical v1 read view를 만든다. legacy v0 read projection에서는 `orderId: null`, `entitlementId: null`, `userBinding: null`을 허용하지만 신규 v1 write에는 허용하지 않는다. adapter는 기존 JSON이나 document를 수정하지 않는다.

## v1 planned collection 구조

다음 구조는 repository interface와 문서 계약이다. 이번 작업에서 운영 데이터를 쓰거나 backfill하지 않는다.

### `users/{userId}`

- primary ID: 검증된 카카오 subject 기반 `userId`, 1..128자의 불투명 값
- 필수 필드: UserAccount v1 전체 필드
- write: auth service만 create/update authentication metadata
- read: 현재 사용자 자기 계정, 또는 명시적 admin 권한의 최소 projection
- 금지: client-supplied owner/provider binding

### `productCatalogSnapshots/{catalogSnapshotId}`

- primary ID: `sha256("unwoldang:product-catalog-snapshot:v1:" + catalogHash + ":" + effectiveAt)`; `catalogHash`는 canonical ordered products의 SHA-256
- 필수 필드: snapshot status, effectiveAt, products, catalogHash와 공통 필드
- write: 배포·catalog service만
- read: 공개 API가 필요한 필드만 반환; Firestore 직접 공개 금지
- 주문은 생성 당시 `catalogSnapshotId`를 보존

### `orders/{orderId}`

- primary ID: 기존 `UW-...` order ID
- write: order/payment service만; 상태 전이는 transaction/precondition으로 검사
- read: 인증 owner 또는 권한 있는 admin
- 가격·통화·상품 snapshot은 서버 registry에서 고정

### `payments/{paymentId}`

- primary ID: 기존 runtime에서 `paymentId === orderId`이며 `UW-...` 형식을 유지
- write: payment verification service만
- read: 인증 owner의 최소 payment projection 또는 권한 있는 admin
- 공급자 응답 원문·secret·card/account data는 저장하지 않음
- legacy source는 `portonePaymentConfirmations`에서 pure projection하며 이 작업에서 복사하지 않음

### `entitlements/{entitlementId}`

- primary ID: lowercase 64-character SHA-256; legacy 값은 `sha256("portone:" + paymentId)` 유지
- write: verified paid Payment를 처리하는 entitlement service만
- read: 인증 owner와 report authorization service
- active 생성 전 Payment paid 상태를 transaction에서 재확인
- refunded Payment의 기존 entitlement 자동 변경 금지

### `reportGenerationJobs/{jobId}`

- primary ID: lowercase 64-character SHA-256 `sha256("unwoldang:report-job:v1:" + entitlementId)`
- logical idempotency hash: `sha256("unwoldang:report-generation:v1:" + entitlementId + ":" + inputHash)`
- write: report generation service만
- read: 인증 owner의 상태 projection 또는 운영 admin
- entitlement당 최초 inputHash 고정; 다른 hash는 transaction에서 거부
- lease 변경은 Firestore update-time precondition 또는 transaction을 사용

### `reportArchives/{documentId}`

- physical document ID: 기존 공식식 `sha256(ownerUserId + ":" + archiveId)` 유지
- canonical fields: ReportArchive v1 전체 필드
- write: archive service가 user token과 report token의 owner/order/product/entitlement를 검증한 뒤 수행. 동일 ID가 있으면 먼저 owner/order/product binding을 확인한다.
- read: 항상 `ownerUserId` 조건을 포함; legacy query compatibility를 위해 adapter는 `userId`도 이해
- 기존 v0 document를 rewrite하지 않음
- create는 `exists=false`, update는 직전 GET의 Firestore `updateTime` precondition을 사용해 무조건 overwrite와 경쟁 쓰기를 거부

v1 archive 운영 write는 이번 작업에서 비활성화한다. 같은 `reportArchives` collection에 v1을 쓰기 전 다음 중 하나를 별도 승인해야 한다.

1. 별도 v1 collection으로 전환하고 legacy `reportArchives`를 read fallback으로 유지한다.
2. 같은 document에 v1 canonical 필드와 legacy `userId`/`entryJson`을 함께 보존하는 dual-shape writer를 사용한다.

같은 collection의 mixed v0/v1을 선택하면 reader는 `schemaVersion` dispatcher를 사용하고, owner 목록은 `userId == owner`와 `ownerUserId == owner` 결과를 document ID로 중복 제거한 뒤 `createdAt DESC`로 정렬해야 한다. cursor는 source query별로 분리한다. 구버전 rollback이 필요한 동안 legacy 필드를 삭제하지 않는다. 이 선택이 승인되기 전 canonical ReportArchive writer를 활성화하지 않는다.

### `adminAuditEvents/{eventId}`

- primary ID: 서버 발급 불투명 ID, 최대 200자
- write: admin authorization/action boundary만; append-only
- read: 별도 audit-reader 권한을 가진 admin만
- 허용 metadata만 저장하고 request body, report data, token, provider error 원문은 저장하지 않음

## Repository interface 경계

도메인 service는 collection 이름이나 Firestore REST wire format을 직접 알지 않는다. 다음 논리 interface를 통해 접근한다.

| interface | 최소 책임 |
| --- | --- |
| `UserAccountRepository` | owner/provider lookup, create/update authentication metadata |
| `ProductCatalogSnapshotRepository` | current snapshot 조회, immutable snapshot 생성 |
| `OrderRepository` | create, owner lookup, preconditioned 상태 전이 |
| `PaymentRepository` | provider payment idempotent create/read, owner 목록 |
| `EntitlementRepository` | paid-gated issue, owner 목록, revoke 명령 |
| `ReportGenerationJobRepository` | entitlement 고정 job, immutable inputHash acquisition, lease, complete/fail |
| `ReportArchiveRepository` | owner-scoped upsert/list, legacy read projection |
| `AdminAuditEventRepository` | append-only event 기록과 제한된 감사 조회 |

`legacyPaymentLedgerAdapter`와 `legacyReportArchiveAdapter`는 source v0 문서를 canonical v1 view로 읽는 compatibility boundary다. adapter 자체는 write하지 않는다. 목적별 repository 메서드는 expected status/update time, paid Payment, authenticated owner, job lease와 inputHash를 인자로 받아 generic update 우회를 막는다.

새 repository가 legacy collection에 canonical 필드를 dual-write하는 기능은 이번 작업에서 제공하지 않는다. 이는 mixed archive 전략을 승인하기 전 v1 archive write 자체가 비활성이라는 뜻이다.

## 인덱스

### Current

| collection | query | 요구사항 |
| --- | --- | --- |
| configured payment ledger | `userId == value`, limit | Firestore automatic single-field index. composite index 없음. |
| configured report archive | `userId == value`, limit | Firestore automatic single-field index. 정렬은 현재 메모리에서 수행. composite index 없음. |

### Planned — 실제 query 도입 시에만 생성

아래 목록은 계약상 예상 query다. 이 작업에서는 index를 생성하거나 배포하지 않는다. 구현 query가 추가될 때 `firestore.indexes.json`과 배포 절차를 별도 변경으로 검토한다.

| collection | composite fields |
| --- | --- |
| `productCatalogSnapshots` | `status ASC`, `effectiveAt DESC` |
| `orders` | `ownerUserId ASC`, `createdAt DESC` |
| `orders` | `ownerUserId ASC`, `status ASC`, `createdAt DESC` |
| `payments` | `ownerUserId ASC`, `confirmedAt DESC` |
| `entitlements` | `ownerUserId ASC`, `status ASC`, `issuedAt DESC` |
| `entitlements` | `ownerUserId ASC`, `productId ASC`, `status ASC` |
| `reportGenerationJobs` | `status ASC`, `leaseExpiresAt ASC` |
| `reportGenerationJobs` | `ownerUserId ASC`, `status ASC`, `updatedAt DESC` |
| `reportArchives` | `ownerUserId ASC`, `createdAt DESC` |
| `reportArchives` | `ownerUserId ASC`, `status ASC`, `createdAt DESC` |
| `reportArchives` | `ownerUserId ASC`, `productId ASC`, `createdAt DESC` |
| `adminAuditEvents` | `actorAdminId ASC`, `createdAt DESC` |
| `adminAuditEvents` | `resourceType ASC`, `resourceIdHash ASC`, `createdAt DESC` |
| `adminAuditEvents` | `action ASC`, `createdAt DESC` |

Payment ID, Entitlement ID, Job ID와 idempotency uniqueness는 composite index가 아니라 deterministic ID와 atomic create/transaction으로 보장한다.

## 운영 배포와 권한

- Cloud Run runtime service account에는 실제 사용 중인 두 legacy collection과 도입된 canonical collection에 필요한 최소 document read/write 권한만 부여한다.
- 일반 사용자 token과 admin token은 Firestore bearer token이 아니다.
- `FIRESTORE_ACCESS_TOKEN`은 로컬 emulator/manual REST 용도이며 운영 Cloud Run에 설정하지 않는다.
- server secret, provider response body 또는 access token을 Firestore error/audit document에 저장하지 않는다.
- collection rename, TTL, bulk export/import, index creation은 별도 운영 변경과 rollback 승인을 요구한다.
