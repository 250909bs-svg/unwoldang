# 운월당 토스 결제 연결 메모

## 1. 프론트 환경변수

`.env.local` 또는 배포 환경변수에 아래 값을 넣습니다.

```env
VITE_PAYMENT_MODE=test
VITE_TOSSPAYMENTS_CLIENT_KEY=test_ck_xxxxxxxxxxxxx
VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT=https://your-api.example.com/payments/toss/confirm
```

- `demo`: 결제창 없이 바로 성공 흐름 확인
- `test`: 토스 테스트 결제
- `live`: 실제 라이브 결제

## 2. 서버 환경변수

```env
TOSS_SECRET_KEY=test_sk_xxxxxxxxxxxxx
```

라이브 전환 시에는 테스트 키를 라이브 키로 교체합니다.

## 3. 승인 API

현재 저장된 스켈레톤 파일:

- `api/payments/toss/confirm.js`

이 API는 아래 값을 받아 토스 결제 승인 API를 호출합니다.

```json
{
  "paymentKey": "토스가 준 paymentKey",
  "orderId": "UW-...",
  "amount": 79000
}
```

## 4. 프론트 결제 흐름

- 결제 화면: `src/pages/Checkout.tsx`
- 콜백 화면: `src/pages/PaymentCallback.tsx`
- 로딩 화면: `src/pages/Loading.tsx`
- SDK 로더: `src/lib/tossPayments.ts`

## 5. 실제 테스트 순서

1. `VITE_PAYMENT_MODE=test`로 변경
2. 테스트 클라이언트 키 입력
3. 승인 API 주소 입력
4. 서버에 `TOSS_SECRET_KEY` 입력
5. 결제 화면에서 테스트 결제 진행
6. 성공 시 `/payment/toss/callback` -> `/loading` -> `/report/:id` 흐름 확인

## 6. 출시 전 마지막 체크

- 성공 URL / 실패 URL 도메인이 실제 운영 도메인인지
- 승인 API가 실서버에서 HTTPS로 열리는지
- 주문금액과 승인금액 검증이 서버에서 이뤄지는지
- 테스트 키가 아니라 라이브 키로 교체됐는지
- 개인정보처리방침과 환불정책 링크가 결제 전 화면에서 열리는지
