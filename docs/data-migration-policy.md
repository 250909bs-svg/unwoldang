# 데이터 migration·하위 호환 정책

## 이번 변경의 경계

이번 작업은 migration runner가 아니다.

- 운영 Firestore 문서를 조회·수정·삭제하지 않는다.
- collection rename, copy, backfill, TTL, bulk export/import를 수행하지 않는다.
- legacy collection과 canonical collection 사이의 dual-write를 시작하지 않는다.
- 브라우저 localStorage/sessionStorage key를 rename하거나 일괄 삭제하지 않는다.
- source document를 canonical v1로 읽는 pure projection adapter와 향후 migration 계획만 정의한다.

공식 target version은 `DATA_SCHEMA_VERSION = 1`이다. 저장 데이터에 `schemaVersion`이 없으면 source version `0`으로 분류한다. `DATA_MIGRATION_REGISTRY`는 기본 collection 계약이며, override 배포에서는 `createDataMigrationRegistry(resolveFirestoreCollections(env))`를 사용한다. 둘 다 source/target과 pure projection을 설명할 뿐 실행·write·delete 권한을 갖지 않는다.

## 공통 version 규칙

1. 신규 canonical write는 `schemaVersion: 1`, canonical UTC `createdAt`/`updatedAt`, 1..512자의 non-empty `idempotencyKey`를 반드시 포함한다.
2. `updatedAt`은 `createdAt`보다 빠를 수 없다.
3. version이 없는 legacy 문서는 source v0 adapter에서만 읽는다.
4. unknown future version은 추측하여 읽거나 downgrade하지 않고 안전하게 거부한다.
5. adapter는 저장 문서를 수정하지 않고 메모리의 canonical read view만 반환한다.
6. security binding이 불완전한 legacy 값은 신규 write 자격이나 새로운 권한의 근거로 사용하지 않는다.
7. 새 version을 도입할 때는 이전 version별 명시 migration과 rollback/read compatibility를 먼저 추가한다.

## Firestore legacy adapter

### Payment ledger v0

Source:

- collection: 기본 `portonePaymentConfirmations`, 실제 이름은 `PORTONE_PAYMENT_LEDGER_COLLECTION`
- document ID: `sha256("portone:" + paymentId)`
- source version: `0` when `schemaVersion` is absent

Compatibility exports:

- `getLegacyPaymentLedgerDocumentId`
- `projectLegacyPaymentLedger`
- `getLegacyReportGenerationJobId`

Projection 원칙:

| legacy data | canonical read view |
| --- | --- |
| payment/order/provider-verified fields | Payment v1 view |
| `userId`, `userBinding`, `entitlementId`, entitlement fields | Entitlement v1 view |
| input hash, generation status/lease/attempt/result fields | ReportGenerationJob v1 view |
| Firestore `createTime`, `updateTime` | canonical createdAt/updatedAt fallback |

- 기존 `paymentId`, `orderId`, 상품 ID, 가격, transaction ID와 entitlement ID를 변경하지 않는다.
- legacy entitlement ID `sha256("portone:" + paymentId)`를 유지한다.
- legacy report job ID는 canonical entitlement-only helper `sha256("unwoldang:report-job:v1:" + entitlementId)`를 사용하고, entitlement+inputHash operation idempotency key는 별도로 투영한다.
- legacy `reportGenerationFailure` 원문은 canonical public error나 errorCode로 복사하지 않고 고정 `LEGACY_REPORT_GENERATION_FAILED`로 분류한다.
- projection 결과를 `portonePaymentConfirmations`, `payments`, `entitlements` 또는 `reportGenerationJobs`에 write-back하지 않는다.
- 기존 payment/report runtime write path는 그대로 유지된다. adapter가 별도의 두 번째 write를 만들지 않는다.

### Report archive v0

Source:

- collection: 기본 `reportArchives`, 실제 이름은 `FIRESTORE_ARCHIVE_COLLECTION`
- physical document ID: `sha256(userId + ":" + archiveId)`
- source version: `0` when `schemaVersion` is absent

Compatibility exports:

- `getLegacyReportArchiveDocumentId`
- `projectLegacyReportArchive`
- `assertLegacyReportArchiveOwnerScope`

Projection 원칙:

1. top-level `userId`를 owner authority로 사용하고, `entryJson` 안의 owner 비슷한 필드를 신뢰하지 않는다.
2. `entryJson`을 파싱하되 archive ID, product ID, order ID가 top-level binding과 모순되면 권한 있는 신규 write로 승격하지 않는다.
3. 기존 문서에서 빠질 수 있는 `orderId`, `entitlementId`, `userBinding`은 v0 compatible read view에서만 `null`을 허용한다.
4. 신규 v1 archive write에는 검증된 order, entitlement, product, owner 및 userBinding이 모두 필요하다.
5. 목록 및 ID 조회는 항상 인증 owner scope를 요구한다. archive ID를 아는 것만으로 조회할 수 없다.
6. 기존 `entryJson`, document ID, 리포트 URL, report data를 rewrite하지 않는다.

v0/v1을 같은 `reportArchives` collection에 섞는 writer는 아직 승인되지 않았다. 활성화 전에 별도 v1 collection 또는 legacy `userId`/`entryJson`을 보존하는 dual-shape 중 하나를 선택한다. mixed reader를 선택하면 다음을 함께 구현한다.

- `schemaVersion` dispatcher
- `userId`와 `ownerUserId` owner query의 merge/deduplicate/sort
- source별 cursor 및 구버전 rollback 동안 legacy field 보존

## Canonical collection 도입 단계

향후 실제 도입은 별도 승인과 다음 단계로 진행한다.

### 단계 0 — 현재 작업

- collection constants와 repository contracts를 중앙화한다.
- legacy v0 pure projection을 테스트한다.
- canonical collection에는 운영 write를 하지 않는다.
- index, TTL, migration job을 배포하지 않는다.

### 단계 1 — shadow read 검증

- 운영 write 없이 export 또는 승인된 staging fixture로 projection 결과를 비교한다.
- owner, product, amount, status, timestamps, hash 불일치를 집계값으로만 확인한다.
- 이름, 이메일, 생년월일, 질문, report data 원문을 비교 로그에 출력하지 않는다.

### 단계 2 — 신규 canonical write 검토

- 새 리소스에만 canonical repository write를 활성화할지 별도 결정한다.
- legacy 경로와 canonical 경로의 동시 write는 자동으로 선택하지 않는다. 필요하다면 transactional outbox, reconciliation, rollback을 포함한 별도 설계를 승인한다.
- 기존 문서를 backfill하지 않아도 legacy read adapter가 계속 동작해야 한다.
- mixed archive 전략이 승인되기 전에는 canonical ReportArchive write를 활성화하지 않는다.

### 단계 3 — 선택적 backfill

- 법무·보안·운영 승인, dry run, 수량·hash 검증, backup 및 rollback runbook가 있을 때만 수행한다.
- owner binding이 불완전한 archive는 자동 귀속하지 않는다.
- backfill 성공을 확인하기 전 legacy collection을 삭제·rename·read-disable하지 않는다.

이 문서의 어느 단계도 이번 PR에서 실행하지 않는다.

## 브라우저 저장 key inventory

### 중앙 v1 storage contract

`APP_STORAGE_SCHEMA_VERSION`은 현재 `1`이다. v1 JSON은 version envelope 없이 기존 raw JSON 모양을 유지한다. v2 이상에서만 `{ "__unwoldangStorageVersion": n, "payload": ... }` envelope와 명시 migration을 사용한다.

| key | area | serialization/version | 데이터·호환 규칙 |
| --- | --- | --- | --- |
| `unwoldang.auth.user` | local | raw JSON v1 | 기존 AuthUser 모양 유지. ID, nickname, email?, avatar?, provider, authToken?, connectedAt 포함 가능. |
| `unwoldang.auth.kakao.state` | session | raw string v1 | OAuth state. consume 시 일회성으로 제거. |
| `unwoldang.payment.pending` | session | raw JSON v1 | 기존 PendingPayment 모양 유지. formData/analysisPayload/orderClaim/reportAccessToken 포함 가능. |
| `unwoldang.payment.entitlements` | local | raw JSON v1 | `{orderId,productId,createdAt}` 참조만 최대 20개. bearer token과 intake data를 추가하지 않음. |
| `unwoldang.payment.pending.customer.<identity>` | local | raw string v1 | 기존 customer key prefix와 값 유지. identity를 바꾸어 새 key를 만들지 않음. |

중앙 codec은 JSON parse 또는 decode가 실패한 손상값을 현재 제거한다. 이 동작은 정상 legacy payload migration과 구분해야 하며, 유효한 이전 version을 손상값으로 간주해 삭제해서는 안 된다.

### 별도 legacy key

다음 key도 하위 호환 대상이지만 아직 중앙 version registry에 포함되지 않았다.

| key/prefix | area | payload |
| --- | --- | --- |
| `unwoldang.report.archive` | local | 오래된 shared report archive JSON array |
| `unwoldang.report.archive.v2.<owner>` | local | 로그인 사용자별 report archive JSON array |
| `unwoldang.report.archive.v2.guest` | session | guest report archive JSON array |
| `unwoldang.admin.session.v2` | session | local fallback marker `ok` |
| `unwoldang.admin.accessToken.v1` | session | admin bearer token |
| `unwoldang.intake.<productId>` | session | 상품별 IntakeFormData draft |
| `unwoldang.love-intake.v3.<userId>` | session | 로그인 love intake draft |
| `unwoldang.love-intake.v3.guest` | session | guest love intake draft |
| `unwoldang:mz-love-fact:micro-choice` | session | love reaction choice raw string |
| `unwoldang.reward.wallet` | local | reward wallet JSON |
| `unwoldang:mz-love-mission:<reportSerial>` | local | 완료 mission ID JSON array |

이 key들의 이름, storage area 또는 기존 raw payload를 이번 작업에서 변경하지 않는다. 향후 중앙화할 경우 기존 reader를 먼저 유지하고 새 writer는 version별 명시 adapter가 준비된 뒤 전환한다.

## 알려진 교차 팀 위험: shared report archive 삭제

현재 `src/lib/reportArchive.ts`의 reader는 `unwoldang.report.archive`를 읽을 때 해당 localStorage key를 즉시 `removeItem`한다. 기존 테스트도 이 삭제를 기대한다.

이 작업은 문서·Cloud Run 계약 소유 범위이므로 해당 프론트 파일을 수정하지 않았으며, 이 위험이 해결되었다고 간주하지 않는다. 사용자 요구인 비파괴 migration을 충족하려면 프론트 소유팀이 별도 변경으로 다음을 처리해야 한다.

1. 정상 legacy shared archive를 자동 삭제하지 않고 quarantine/read-only로 보존한다.
2. 소유권을 증명할 수 없는 entry를 현재 로그인 사용자에게 자동 귀속하지 않는다.
3. 서버 entitlement/order 또는 명시적 사용자 확인으로 owner를 검증한 뒤에만 account-scoped v2 archive로 복사한다.
4. 복사 성공과 검증 전 legacy key를 삭제하지 않는다.
5. rollback 시 legacy key와 원 payload를 다시 읽을 수 있어야 한다.

또한 legacy archive의 `orderId`가 선택적이지만 현재 report access gate는 replay에도 유효한 `UW-...` order ID를 요구한다. orderId가 없는 legacy entry의 재열람 방식 역시 owner/entitlement 검증 정책과 함께 별도 결정해야 한다.

## Archived 상품 생성 정책 정합성

최신 데이터 계약은 archived 상품에서 신규 입력·주문·생성을 차단하고, 이미 완료된 서버 cache 또는 archive의 재열람만 허용한다. 따라서 `docs/product-module-guide.md`의 과거 “저장된 입력 복구 시 archived 생성 허용” 설명은 신규 `ReportGenerationJob`이나 AI provider 재호출에 적용되지 않는다.

해당 가이드는 상품 플랫폼 소유 문서이므로 이번 작업에서 수정하지 않는다. 과거 완료 결과가 cache/archive에 없을 때 별도 복구 경로가 필요한지는 owner-bound 백업의 존재와 비용·환불 정책을 확인한 뒤 교차 팀에서 결정한다.

## Rollback

현재 단계는 pure read contracts이므로 rollback에 데이터 변환이 필요하지 않다.

1. canonical repository consumer를 이전 application version으로 되돌린다.
2. 환경 변수 `PORTONE_PAYMENT_LEDGER_COLLECTION`, `FIRESTORE_ARCHIVE_COLLECTION`을 기존 값으로 유지한다.
3. 기존 `portonePaymentConfirmations`와 `reportArchives` read/write 경로를 계속 사용한다.
4. adapter가 만든 in-memory projection은 저장되지 않으므로 별도 정리하지 않는다.
5. planned canonical collection에 후속 작업이 데이터를 쓴 경우에도 rollback 중 삭제하지 않는다. write를 중지하고 별도 reconciliation 후 처리한다.
   같은 archive collection의 dual-shape를 선택했다면 구버전 reader가 필요한 `userId`/`entryJson`을 유지한 채 write만 중지한다.
6. index 또는 TTL을 후속 작업에서 추가했다면 해당 변경의 독립 rollback runbook를 따른다.

Rollback 과정에서도 운영 문서, browser key, archive, payment ledger를 자동 삭제하지 않는다.

## Migration 검증 기준

- missing `schemaVersion`을 source v0으로 읽고 canonical v1 view를 생성한다.
- legacy document ID 공식이 기존 값과 byte-for-byte 동일하다.
- legacy payment의 payment/order/product/amount/owner/entitlement 연결을 보존한다.
- legacy archive owner scope를 생략하거나 다른 owner로 바꾸면 거부한다.
- invalid `entryJson`이나 security binding 모순을 신규 v1 write로 승격하지 않는다.
- adapter 호출 전후 Firestore write/delete 요청이 0회임을 테스트한다.
- local/session key 이름과 v1 raw serialization을 snapshot test로 고정한다.
- known shared archive 삭제 위험은 별도 프론트 수정이 병합될 때까지 release risk로 남긴다.
