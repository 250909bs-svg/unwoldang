# 운월당 Gemini 사주 분석 연결 메모

## 1. 프론트 환경변수

`.env.local` 또는 배포 환경변수에 아래 값을 넣습니다.

```env
VITE_REPORT_ENDPOINT=/api/report
```

Cloud Run으로 분리할 때는 아래처럼 바꿉니다.

```env
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
```

프론트 요청 코드는 [aiReport.ts](C:/Users/1/Documents/unwoldang/src/lib/aiReport.ts)에서 처리합니다.

## 2. 서버 환경변수

Vercel Functions 또는 Cloud Run에 아래 값을 넣습니다.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Cloud Run에서는 추가로 CORS 허용 도메인을 넣을 수 있습니다.

```env
ALLOWED_ORIGINS=https://unwoldang.com,https://www.unwoldang.com
```

## 3. 현재 구조

운월당의 사주 리포트는 아래 순서로 생성됩니다.

1. 입력값을 `IntakeFormData` 형태로 정리
2. [deterministicBasis.ts](C:/Users/1/Documents/unwoldang/src/lib/saju/deterministicBasis.ts)에서 결정론적 계산 basis 생성
3. [report.ts](C:/Users/1/Documents/unwoldang/src/lib/saju/report.ts)에서 기본 리포트 생성
4. [premiumReportPrompt.ts](C:/Users/1/Documents/unwoldang/src/lib/saju/premiumReportPrompt.ts) 기반으로 Gemini draft 요청
5. Gemini가 돌려준 문장/설명 블록만 merge
6. 최종 `SajuReportData`를 프론트 결과 페이지로 전달

핵심 원칙은 이겁니다.

- 계산: 코드
- 해석: Gemini
- 렌더링: 프론트 결과 UI

## 4. 공용 서버 엔진

이제 Gemini 리포트 생성 로직은 공용 서비스로 분리되어 있습니다.

- 공용 엔진: [geminiReportService.ts](C:/Users/1/Documents/unwoldang/src/lib/server/geminiReportService.ts)
- Vercel 함수: [report.ts](C:/Users/1/Documents/unwoldang/api/report.ts)
- Cloud Run 서버: [index.ts](C:/Users/1/Documents/unwoldang/cloudrun-api/src/index.ts)

즉, 리포트 생성 로직을 한 번만 수정하면 Vercel과 Cloud Run 양쪽에 같이 반영됩니다.

## 5. Cloud Run 백엔드 폴더

Cloud Run용 백엔드 패키지는 아래 경로에 있습니다.

- 폴더: [cloudrun-api](C:/Users/1/Documents/unwoldang/cloudrun-api)
- 설명 문서: [README.md](C:/Users/1/Documents/unwoldang/cloudrun-api/README.md)
- Dockerfile: [Dockerfile](C:/Users/1/Documents/unwoldang/cloudrun-api/Dockerfile)

제공 경로:

- `GET /health`
- `POST /api/report`
- `POST /report`

## 6. 로컬 확인 순서

### 프론트만 볼 때

현재 정적 미리보기 서버에서는 `api/report`가 실행되지 않습니다.  
즉, 화면 확인만 가능하고 Gemini 백엔드 자체는 돌아가지 않습니다.

### Cloud Run 백엔드 로컬 번들 확인

```powershell
cd C:\Users\1\Documents\unwoldang\cloudrun-api
npm.cmd run build
node dist/index.js
```

건강 확인:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/health
```

리포트 요청:

```powershell
Invoke-WebRequest `
  -Uri http://127.0.0.1:8080/api/report `
  -Method POST `
  -ContentType application/json `
  -Body '{"serviceId":"general-signature","payload":{"user":{"name":"차민호","gender":"male"},"birth":{"calendar":"solar","isLeapMonth":false,"date":"1992-09-09","time":"10:24","isUnknownTime":false},"questions":["지금 가장 조심해야 할 선택은 무엇인가요?","2026년에 커리어를 어떻게 확장하는 게 좋을까요?"]}}'
```

Gemini 키가 없으면 fallback 리포트로 응답하고, 키가 있으면 Gemini draft가 merge됩니다.

## 7. 다음 단계

실제 연결을 진행할 때 가장 자연스러운 순서는 아래입니다.

1. Cloud Run에 `GEMINI_API_KEY`와 `GEMINI_MODEL` 설정
2. `cloudrun-api` 이미지 빌드 및 배포
3. Cloud Run URL 확인
4. 프론트의 `VITE_REPORT_ENDPOINT`를 Cloud Run URL로 변경
5. 종합사주 1건 실제 테스트
