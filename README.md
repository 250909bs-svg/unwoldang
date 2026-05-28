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
VITE_PAYMENT_MODE=
VITE_PORTONE_STORE_ID=
VITE_PORTONE_CHANNEL_KEY=
VITE_PORTONE_CONFIRM_ENDPOINT=
VITE_PORTONE_DEFAULT_PHONE_NUMBER=
VITE_PORTONE_DEFAULT_EMAIL=
VITE_ENABLE_CLIENT_ADMIN=false
```

서버 전용 값은 Cloud Run Secret Manager 또는 Cloud Run 환경변수에만 둡니다.

```env
GEMINI_API_KEY=
GEMINI_MODEL=
KASI_SERVICE_KEY=
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
