# 운월당 웹앱 인수인계

운월당 사주 리포트 웹앱입니다. 새 PC에서 이어 작업할 때는 아래 순서대로 복구하면 됩니다.

## GitHub 저장소

- 저장소: https://github.com/250909bs-svg/unwoldang
- 기본 브랜치: `main`
- 공식 홈페이지: https://www.unwoldang.com/
- 로컬 미리보기 기본 주소: http://127.0.0.1:4173/

## 새 PC에서 시작하기

```powershell
git clone https://github.com/250909bs-svg/unwoldang.git
cd unwoldang
npm install
Copy-Item .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

브라우저에서 `http://127.0.0.1:4173/`를 열면 로컬 미리보기를 확인할 수 있습니다.

## 배포 전 확인

```powershell
npm run build
npm run test
```

문서만 수정한 경우에는 빌드가 필수는 아니지만, 코드나 리포트 생성 로직을 수정했다면 배포 전 빌드와 테스트를 확인합니다.

## MZ 도깨비 전생사주

기존 종합사주와 분리된 전용 상품입니다. `general-signature`의 입력·계산·리포트 구조를 바꾸지 않고 별도 서비스 ID인 `past-life-goblin`으로 동작합니다.

- 상품 랜딩: `/detail/past-life-goblin`
- 4단계 입력: `/form/past-life-goblin`
- 결제 전 확인: `/checkout`의 `past-life-goblin` 분기
- 5권 리포트: `/report/past-life-goblin`
- 상품·권별 문구: `src/content/pastLifeExperience.ts`
- 영상 제어: `src/components/HeroFilm.tsx`
- 전용 스타일: `src/styles/past-life.css`
- 포스터·영상·권별 WebP: `public/media/`

대표 영상은 화면 밖으로 벗어나면 멈추며, 움직임 감소 설정에서는 포스터로 대체됩니다. 권별 이미지는 WebP를 지연 로딩하고, 공유 카드에는 고객의 생년월일을 넣지 않습니다.

## 환경변수

`.env.local`, 실제 API 키, Secret Manager 값은 GitHub에 올리지 않습니다. 새 PC에서는 `.env.example`을 기준으로 직접 다시 채워야 합니다.

프론트 환경변수는 Vercel 또는 로컬 `.env.local`에 설정합니다.

```env
VITE_REPORT_ENDPOINT=
VITE_KAKAO_REST_API_KEY=
VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT=
VITE_KAKAO_REDIRECT_ORIGIN=
VITE_KAKAO_SCOPES=
VITE_PUBLIC_SITE_URL=
VITE_PAYMENT_PROVIDER=
VITE_PAYMENT_MODE=
VITE_PORTONE_STORE_ID=
VITE_PORTONE_CHANNEL_KEY=
VITE_PORTONE_CONFIRM_ENDPOINT=
VITE_PORTONE_DEFAULT_PHONE_NUMBER=
VITE_PORTONE_DEFAULT_EMAIL=
VITE_ENABLE_CLIENT_ADMIN=false
```

### 결제 provider 현황

`PAYMENT_PROVIDER` / `VITE_PAYMENT_PROVIDER`가 받는 값은 세 가지이지만, 실제로 결제가 되는 것은 `legacy-portone` 하나입니다.

| 값 | 상태 | 동작 |
| --- | --- | --- |
| `legacy-portone` | 구현 완료 | PortOne(KG이니시스) 결제창과 서버 승인 검증이 동작합니다 |
| `hyphen` | **이름만 존재** | `HyphenPaymentProvider`는 모든 호출이 503을 던지는 placeholder입니다. 결제창, 승인 검증, 웹훅 어느 것도 구현돼 있지 않습니다 |
| `disabled` | 기본값 | 결제와 유료 리포트 발행을 모두 막습니다 |

`hyphen`을 설정하면 프론트는 결제 버튼을 잠그고(`현재 결제 시스템을 준비 중입니다` 대신 `하이픈 결제 연동이 아직 구성되지 않았습니다`), 서버는 `/api/report`에서 503을 반환합니다. 이는 의도된 fail-closed 동작이며, 하이픈 연동 명세를 받기 전까지 API 형태를 추측하지 않기 위한 것입니다.

하이픈을 구현할 때는 `cloudrun-api/src/domains/payments/paymentProvider.ts`의 `HyphenPaymentProvider`, 전용 HTTP 클라이언트(`portoneClient.ts`와 같은 위치), `config/env.ts`의 `payment.configured` 판정, `middleware/auth.ts`의 `paymentUnavailable` 조건, 그리고 프론트 `Checkout.tsx`·`PaymentCallback.tsx`의 provider 분기를 함께 손봐야 합니다.

### 결제를 실제로 여는 데 반드시 필요한 값

결제는 프론트와 백엔드 양쪽 모두에서 명시적으로 켜야 합니다. 둘 중 하나라도 빠지면 결제 버튼이 보이지 않거나 리포트 API가 503을 반환합니다.

| 위치 | 값 | 빠뜨렸을 때 |
| --- | --- | --- |
| Vercel | `VITE_PAYMENT_PROVIDER=legacy-portone` | 프로덕션 빌드가 `disabled`로 판정해 결제 버튼이 잠깁니다 |
| Vercel | `VITE_PAYMENT_MODE=live` | `live`가 아니면 프로덕션에서 `disabled`로 처리됩니다 |
| Cloud Run | `PAYMENT_PROVIDER=legacy-portone` | `/api/report`가 `503 결제 시스템이 준비되지 않아…`를 반환합니다 |
| Cloud Run | `PORTONE_API_SECRET`, `PORTONE_STORE_ID` | 결제 검증이 구성되지 않은 것으로 판정됩니다 |

`cloudrun-api/deploy-cloudrun.ps1`의 `-PaymentProvider` 기본값은 안전을 위해 `disabled`입니다. 실제 판매 배포에서는 반드시 `-PaymentProvider legacy-portone`을 직접 넘겨야 합니다.

#### provider 병행 운영은 아직 불가능합니다

`createPaymentProvider`는 설정값 하나로 provider **한 개**를 만들고, 결제 원장(`PaymentLedger`)에는 어떤 provider로 승인됐는지 기록하는 필드가 없습니다. `confirmPayment`도 PortOne의 `storeId`와 응답 형태를 전제로 작성돼 있습니다.

따라서 지금은 환경변수로 **전환**만 가능하고 동시 운영은 안 됩니다. 전환 직후에는 이전 provider로 결제된 건의 승인 조회·취소가 새 provider로 잘못 라우팅될 수 있으므로, 병행이 필요해지면 원장에 provider 필드를 먼저 추가해야 합니다.

서버 전용 값은 Cloud Run Secret Manager 또는 Cloud Run 환경변수에만 둡니다.

```env
GEMINI_API_KEY=
GEMINI_MODEL=
KASI_LUNAR_SERVICE_KEY=
KASI_SPECIALDAY_SERVICE_KEY=
KASI_SERVICE_KEY= # legacy fallback only
REPORT_ACCESS_SECRET=
PORTONE_API_SECRET=
PORTONE_STORE_ID=
PORTONE_API_BASE_URL=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
ALLOWED_ORIGINS=
```

## 현재 결제 상태

현재 코드의 실결제 구조는 PortOne/KG이니시스 기준입니다.

- 프론트 결제창: `src/lib/portonePayments.ts`
- 결제 페이지: `src/pages/Checkout.tsx`
- 결제 콜백: `src/pages/PaymentCallback.tsx`
- 서버 검증: `cloudrun-api/src/index.ts`
- 검증 엔드포인트: `/api/payments/portone/confirm`

토스페이먼츠 직접 연동은 아직 별도 작업이 필요합니다. 토스로 전환하려면 프론트 SDK, 성공/실패 콜백, Cloud Run의 `/api/payments/toss/confirm`, 토스 시크릿 키 기반 승인 검증을 추가해야 합니다.

## Cloud Run 백엔드

Cloud Run 백엔드는 `cloudrun-api` 폴더에 있습니다.

```powershell
cd cloudrun-api
npm install
npm run build
```

배포 절차와 Secret Manager 설정은 아래 문서를 기준으로 확인합니다.

- `docs/cloudrun-gemini-launch-checklist.md`
- `docs/launch-payment-checklist.md`
- `cloudrun-api/README.md`

## 컴퓨터 처분 전 체크리스트

1. `git status --short --branch`가 깨끗한지 확인합니다.
2. `git push origin main` 결과가 `Everything up-to-date`인지 확인합니다.
3. `.env.local`, 키 파일, 서비스 계정 JSON은 GitHub에 올리지 말고 안전한 비밀번호 관리자나 각 서비스 콘솔에 보관합니다.
4. 새 PC에서 `git clone` 후 `.env.example`을 기준으로 환경변수를 다시 설정합니다.
