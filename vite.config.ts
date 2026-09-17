import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const CLOUD_RUN_API_ORIGIN = 'https://unwoldang-report-api-pt76url4oa-du.a.run.app'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 배포된 Cloud Run의 ALLOWED_ORIGINS에 localhost가 없어서 브라우저가 CORS로 막는다.
    // 개발 서버가 대신 호출하면 CORS를 타지 않으므로 로컬에서도 리포트 흐름을 끝까지 볼 수 있다.
    // dev 전용 설정이라 프로덕션 빌드에는 영향이 없다. .env.local이 이 경로를 가리킨다.
    proxy: {
      '/cloudrun': {
        target: CLOUD_RUN_API_ORIGIN,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cloudrun/, ''),
      },
    },
  },
})
