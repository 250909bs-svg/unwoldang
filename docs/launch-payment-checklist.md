# 운월당 판매 전환 체크리스트

## 1. 현재 완료된 상태

- Cloud Run 리포트 API: `https://unwoldang-report-api-348612237380.asia-northeast3.run.app/api/report`
- Cloud Run 토스 승인 API: `https://unwoldang-report-api-348612237380.asia-northeast3.run.app/api/payments/toss/confirm`
- KASI 음양력/절기 검증: `KASI_SERVICE_KEY` Secret 연결 완료
- Gemini 사주 리포트 생성: Cloud Run에서 정상 동작
- 프론트 결제 흐름: 입력 -> 결제 -> 콜백 -> 로딩 -> 결과 -> 마이페이지 다시보기

## 2. 토스페이먼츠 키 등록

토스페이먼츠 콘솔에서 발급받은 시크릿 키를 `toss-secret-key.txt` 같은 로컬 파일에 저장한 뒤 아래 명령을 실행합니다.

```powershell
gcloud secrets create TOSS_SECRET_KEY --data-file="C:\path\to\toss-secret-key.txt"
```

이미 Secret이 있다면 새 버전만 추가합니다.

```powershell
gcloud secrets versions add TOSS_SECRET_KEY --data-file="C:\path\to\toss-secret-key.txt"
```

Cloud Run 실행 계정에 권한을 부여합니다.

```powershell
$projectNumber = (gcloud projects describe unwoldang-493313 --format="value(projectNumber)").Trim()
gcloud secrets add-iam-policy-binding TOSS_SECRET_KEY `
  --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

Toss Secret까지 포함해서 재배포합니다.

```powershell
.\cloudrun-api\deploy-cloudrun.ps1 `
  -ProjectId unwoldang-493313 `
  -Region asia-northeast3 `
  -KasiSecretName KASI_SERVICE_KEY `
  -TossSecretName TOSS_SECRET_KEY
```

## 3. 프론트 운영 환경변수

실제 배포 환경에는 아래 값을 넣습니다.

```env
VITE_PAYMENT_MODE=live
VITE_TOSSPAYMENTS_CLIENT_KEY=토스_클라이언트_키
VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT=https://unwoldang-report-api-348612237380.asia-northeast3.run.app/api/payments/toss/confirm
VITE_REPORT_ENDPOINT=https://unwoldang-report-api-348612237380.asia-northeast3.run.app/api/report
```

테스트 결제 중이면 `VITE_PAYMENT_MODE=test`로 두고 토스 테스트 키를 사용합니다.

## 4. 판매 전 최종 테스트

- 테스트 카드 결제 성공 후 결과 페이지로 이동되는지 확인
- 결제 취소/실패 시 주문 화면으로 돌아갈 수 있는지 확인
- 결제 완료 후 로딩 화면에서 새로고침해도 결과 생성이 이어지는지 확인
- 결과가 마이페이지 다시보기에 저장되는지 확인
- 실제 도메인에서 `VITE_PAYMENT_MODE=demo`가 아닌지 확인

## 5. 운영 주의

- 브라우저에는 토스 클라이언트 키만 노출됩니다.
- 토스 시크릿 키, Gemini 키, KASI 키는 절대 프론트 환경변수에 넣지 않습니다.
- 결제 승인 실패, 리포트 생성 실패 문의는 주문번호 기준으로 응대합니다.
