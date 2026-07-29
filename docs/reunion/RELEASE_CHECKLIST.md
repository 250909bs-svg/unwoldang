# MZ큐피트 재회운 출시 체크리스트

> 상태 기준일: 2026-07-21
> `[x]`는 저장소에서 확인한 구현 상태일 뿐 운영 배포·법률 검토 완료를 뜻하지 않는다. `[ ]`가 하나라도 P0에 남으면 상용 출시 승인으로 보지 않는다.

## P0 — 출시 차단 항목

### 운영 배포

- [ ] **운영 Cloud Run 구버전을 최신 검증 commit으로 재빌드·재배포한다.**
- [ ] Cloud Run revision에 Git commit SHA와 배포 시각을 기록한다.
- [ ] 신규 revision에서 `GET /health`의 `readyForReportGeneration`과 `readyForPaymentConfirmation`을 확인한다.
- [ ] 정상·오류 로그를 확인한 뒤 트래픽을 이전하고 이전 revision 롤백 절차를 기록한다.
- [ ] Vercel 운영 환경의 `VITE_REPORT_ENDPOINT`, archive, PortOne confirm, Kakao exchange endpoint가 신규 Cloud Run URL을 가리키는지 확인한다.
- [ ] `ALLOWED_ORIGINS`에 실제 운영 도메인만 허용되는지 확인한다.

### 서버 권위 재회운 결과

- [x] 프런트엔드 결정론 재회운 엔진과 버전 필드가 있다.
- [x] 14개 지표, EvidenceGraph, SafetyGate, 런타임 QA가 있다.
- [ ] 재회운 전용 계산을 Cloud Run 서버에서 실행한다.
- [ ] 결제 entitlement에 정규화 입력 해시, 룰 버전, 엔진 버전, 재회운 결과를 바인딩한다.
- [ ] 클라이언트가 보낸 점수·SafetyGate 상태·연락 허용값을 서버가 신뢰하지 않는다.
- [ ] 새로고침·결제 복귀·다른 기기에서 동일한 서버 결과를 복원한다.
- [ ] 동일 입력·동일 기준 시각·동일 버전의 결과 재현성을 검증한다.

### 안전

- [x] 폭력·위협·스토킹/신고·강압 통제·자해 압박 시 `ANALYSIS_BLOCKED`가 된다.
- [x] 비접촉 요구·차단·우회·새 관계 방해·금전 착취 시 `CONTACT_PROHIBITED`가 된다.
- [x] 준비 미흡 시 `PREPARATION_REQUIRED`로 연락 시기·문구를 숨긴다.
- [x] SafetyGate가 명리 신호보다 먼저 적용되는 단위 테스트가 있다.
- [ ] 서버에서도 같은 SafetyGate를 강제하고 클라이언트 우회를 통합 테스트한다.
- [ ] 임상·가정폭력·스토킹 대응 경험이 있는 외부 안전 전문가에게 문구와 분기 검토를 받는다.
- [ ] 지역별 긴급 안내와 책임 있는 CS 에스컬레이션 절차를 확정한다.

### 개인정보와 삭제

- [x] 성인·정보 처리 동의·정보 사용 권한이 없으면 분석을 차단한다.
- [ ] 수집 필드별 목적·민감도·보존 기간·저장 위치 데이터 인벤토리를 작성한다.
- [ ] `reportArchives.entryJson`에 들어가는 재회운 데이터를 최소화하고 허용 목록으로 직렬화한다.
- [ ] 사용자용 서버 아카이브 삭제 API와 UI를 구현한다.
- [ ] Firestore 원본, 파생 리포트, 생성 캐시, 로그, 백업의 삭제 범위와 기한을 문서화한다.
- [ ] 열람·정정·삭제 요청과 관리자 처리 감사 로그를 구현한다.
- [ ] 제3자 출생정보 처리 근거, 개인정보 처리방침, 위탁·국외 처리 고지를 법률 검토한다.
- [ ] 운영 로그와 오류 추적에서 생년월일·메시지 원문·관계 서술을 마스킹한다.

### 결제·환불

- [x] Cloud Run 카탈로그에 `love-reunion` 55,000원이 정의되어 있다.
- [x] 서버 서명 주문, PortOne 결제 확인, 사용자 귀속 entitlement와 단기 리포트 token 구조가 있다.
- [ ] 운영 PortOne 상품 금액, 스토어 ID, KRW 검증을 실제 소액 결제로 확인한다.
- [ ] 결제 취소·환불 API와 PortOne 상태 동기화를 구현한다.
- [ ] 생성 실패·중복 결제·생성 전후 환불·환불 후 권한 회수 정책을 확정한다.
- [ ] 고객용 환불 고지와 CS 처리·감사 기록을 마련한다.

### 전문가·표시 광고

- [x] 화면과 결과에서 자미두수를 `UNVERIFIED`, `usedForScoring=false`로 표시한다.
- [x] 외부 명리 전문가 감수 전이라는 제한을 결과에 표시한다.
- [ ] 전문가 신청·자격 확인·배정·검수·수정·승인·전자서명·감사 이력 시스템을 구현한다.
- [ ] 실제 건별 승인 증거가 생기기 전 시그니처 전문가 상품과 “전문가 검수 완료” 문구를 숨긴다.
- [ ] “100% 정확”, “무조건 재회”, “상대 속마음 확정”, “정확한 연락 날짜” 표현이 광고·SEO·결제 화면에도 없는지 확인한다.

## P1 — 운영 품질 필수

### 자동 테스트

- [x] 재회운 SafetyGate 단위 테스트가 있다.
- [x] 14개 지표·근거/반대 근거·자미두수 제외·동일 입력 재현성 테스트가 있다.
- [ ] 재회운 테스트와 전체 `vitest run`을 깨끗한 checkout에서 통과시킨 증적을 CI에 남긴다.
- [ ] `tsc -b`와 production build, SEO 정적 페이지 생성을 CI에서 통과시킨다.
- [ ] Cloud Run API 테스트에 안전 override, entitlement 바인딩, archive 사용자 격리를 추가한다.
- [ ] 금지 문구 검사를 랜딩·미리보기·결제·리포트·SEO 산출물 전체로 확장한다.

권장 로컬 명령:

```powershell
npm test -- src/lib/reunion/safetyGate.test.ts src/lib/reunion/reportEngine.test.ts
npm test
npm run build
```

현재 `package.json`에는 `lint` 스크립트가 있지만 ESLint 패키지·설정 존재 여부를 별도로 확인해야 한다. 명령 이름만 보고 lint 게이트가 작동한다고 가정하지 않는다.

### 모바일·접근성

- [ ] iOS Safari, Android Chrome 실제 기기에서 360/390/430px 입력·미리보기·결제 복귀·리포트를 검수한다.
- [ ] 키보드가 열린 상태에서 다음 입력과 CTA가 가려지지 않는지 확인한다.
- [ ] 스크린리더 이름, focus 순서, 오류 안내, 색 대비, `prefers-reduced-motion`을 확인한다.
- [ ] 느린 4G에서 이미지·CSS·리포트 로딩과 재시도를 확인한다.
- [ ] 인앱 브라우저와 Kakao 로그인 복귀를 확인한다.

### 데이터·관측성

- [ ] 원문 개인정보 없이 SafetyGate 상태, 룰 버전, 오류 코드, 생성 지연만 관측하도록 로그 스키마를 정한다.
- [ ] 결제 성공 대비 생성 성공률, 안전 차단률, 복원 성공률, 환불률을 익명 집계한다.
- [ ] Cloud Run 오류율·지연·Firestore 실패·PortOne 실패 알림을 설정한다.
- [ ] 장애 시 결정론 fallback이 안전 정책과 권한 검사를 건너뛰지 않는지 확인한다.

## P2 — 외부 검증과 고도화

- [ ] 외부 명리 전문가가 골든 fixture와 경계 사례를 블라인드 검토한다.
- [ ] 전문가 의견이 갈린 규칙은 합의로 숨기지 않고 불확실성으로 기록한다.
- [ ] 자미두수는 별도 엔진·출처·골든 fixture·전문가 검증이 끝난 뒤에만 feature flag로 도입한다.
- [ ] 대운·세운 완전 동시 교차와 일진 엔진은 독립 검증 전 광고하지 않는다.
- [ ] SafetyGate 오탐·미탐을 익명 사례와 외부 안전 자문으로 정기 점검한다.
- [ ] 개인정보 보호 영향평가와 침해 대응 모의훈련을 수행한다.

## 배포 실행 체크

### 1. 사전 고정

- [ ] 배포 commit SHA: `________________`
- [ ] 프런트엔드 build ID: `________________`
- [ ] Cloud Run revision: `________________`
- [ ] 룰 버전: `reunion-policy-2026.07`
- [ ] 리포트 버전: `reunion-report-v1.0.0`
- [ ] 배포 담당자/승인자: `________________`

### 2. Secret·IAM

- [ ] `REPORT_ACCESS_SECRET`, `USER_ACCESS_SECRET`, `ADMIN_ACCESS_SECRET`가 서로 다르다.
- [ ] PortOne, Gemini, KASI, Kakao secret은 Secret Manager에서만 주입된다.
- [ ] Cloud Run 서비스 계정은 필요한 Firestore 컬렉션과 secret에 최소 권한만 가진다.
- [ ] `ALLOW_UNVERIFIED_REPORTS=false`이며 운영에서 `FIRESTORE_ACCESS_TOKEN`을 사용하지 않는다.
- [ ] `REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=true`다.

### 3. Firestore

- [ ] Native mode와 `(default)` 또는 지정 database ID를 확인한다.
- [ ] `portonePaymentConfirmations`, `reportArchives` 접근 권한을 확인한다.
- [ ] 사용자 A가 사용자 B의 archive를 읽을 수 없는지 검증한다.
- [ ] 동일 결제 재시도가 중복 entitlement를 만들지 않는지 검증한다.
- [ ] 다른 입력을 같은 결제에 바인딩하면 거부되는지 검증한다.

### 4. Smoke test

- [ ] 랜딩 → 7단계 입력 → 미리보기
- [ ] 필수 동의 누락 차단
- [ ] 폭력/거부/차단 안전 분기
- [ ] 정상 주문 → 결제 확인 → 리포트 생성 → archive 복원
- [ ] 상대 출생정보 미상 분기
- [ ] 새로고침·로그아웃·재로그인·다른 기기 복원
- [ ] 결제 실패·Cloud Run timeout·Gemini 실패의 안전한 오류 처리
- [ ] 로컬 DEV 우회가 운영 도메인에서 작동하지 않음

### 5. 출시 승인

- [ ] P0 미완료 항목이 0개다.
- [ ] 개인정보/결제/환불/전문가 표시의 책임자가 서면 승인했다.
- [ ] 롤백 기준과 담당자가 정해졌다.
- [ ] 배포 후 24시간 집중 모니터링을 시작했다.

## 롤백 기준

다음 중 하나면 즉시 신규 판매·트래픽을 중지하고 이전 revision으로 롤백한다.

- SafetyGate 우회 또는 위험 사례에 연락 문구 노출
- 결제 없이 전체 리포트 접근
- 사용자 간 archive 노출
- 금액·상품 불일치 또는 중복 청구
- 재회운 지표가 자미두수·LLM 생성값을 사실처럼 사용
- 민감정보가 로그·분석 도구에 원문으로 노출
- 신규 revision의 지속적인 5xx 또는 리포트 복원 실패

롤백은 개인정보 유출 대응, 잘못된 결제 취소, 이미 생성된 결과 회수와 별개의 절차다. 해당 사고 대응도 동시에 수행한다.
