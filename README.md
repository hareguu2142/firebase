# Gemini Proxy React Playground

Firebase Hosting에 배포할 수 있는 Vite + React 기반의 Gemini API 플레이그라운드 예제입니다.
백엔드는 사용자가 제공한 `geminiProxy`(Cloud Run 서비스 또는 Cloud Functions 2nd gen) 엔드포인트를 사용합니다.

## 1) 사전 준비
- 백엔드 CORS 환경변수 `ALLOWED_ORIGINS`에 **호스팅 도메인**을 추가하세요.
  - 예: `https://your-app.web.app, https://your-app.firebaseapp.com, http://localhost:5173`
- 백엔드가 이미 배포되어 있어야 합니다. (예: `https://<service>-<hash>-<region>.a.run.app`)

## 2) 환경변수
프론트엔드는 다음 변수를 사용합니다.

```bash
VITE_GEMINI_PROXY_URL=https://<당신의-프록시-URL>
```

로컬 개발용으로는 `.env.local` 파일을 프로젝트 루트에 생성하세요.

```bash
cp .env.example .env.local
# 그리고 .env.local 파일에 URL을 채워넣으세요
```

Firebase Hosting에서 **rewrite**를 구성하면 환경변수 설정 없이 `/api/gemini` 경로로 백엔드에 접근할 수 있습니다.
이 프로젝트는 환경변수를 우선 사용하며, 미설정 시 `/api/gemini` 경로를 사용합니다.

### (선택) Firebase Hosting rewrite 예시
`firebase.json` 내 `hosting.rewrites`에 아래 중 하나를 추가하세요.

**Cloud Run 서비스로 라우팅**:
```json
{
  "source": "/api/gemini",
  "run": { "serviceId": "geminiproxy", "region": "asia-northeast3" }
}
```

**Functions 2nd gen로 라우팅**:
```json
{
  "source": "/api/gemini",
  "function": { "functionId": "geminiProxy", "region": "asia-northeast3" }
}
```

> 실제 `serviceId` / `functionId` / `region`은 당신의 GCP 프로젝트에 맞게 변경하세요.

## 3) 주요 기능
- Gemini 모델과 대화할 수 있는 채팅 인터페이스
- 스트리밍 및 일반(non-streaming) 응답 모드 지원
- 모델, 시스템 프롬프트, Temperature, topP, topK 등 다양한 생성 옵션 설정 가능
- 대화 기록이 브라우저의 Local Storage에 자동으로 저장되어 새로고침해도 유지됩니다.

## 4) 로컬 실행
```bash
npm i
npm run dev
# http://localhost:5173
```

## 5) 프로덕션 빌드
```bash
npm run build
npm run preview
```

생성된 정적 파일은 `dist/` 디렉토리에 위치합니다.

## 6) Firebase Hosting 배포
```bash
# Firebase CLI 설치 및 로그인 후
firebase init hosting
# - 'Use an existing project' 선택
# - 'What do you want to use as your public directory?'에 'dist' 입력
# - 'Configure as a single-page app (rewrite all urls to /index.html)?'는 자유롭게 선택
# - 'Set up automatic builds and deploys with GitHub?'는 자유롭게 선택
# 필요시 rewrites 설정 추가

npm run build
firebase deploy --only hosting
```

## 7) 스트리밍 주의사항
- 백엔드가 **POST + text/event-stream**을 사용하므로, 브라우저에서는 `EventSource` API 대신 `fetch`의 ReadableStream으로 응답을 처리합니다.
- 현재 서버 구현상 스트리밍 요청에서는 이전 대화(`history`)가 전송되지 않습니다. (단발성 프롬프트만 전송)

## 8) 문제해결
- **CORS 오류**: 백엔드 `ALLOWED_ORIGINS` 환경변수에 현재 접속한 호스트(예: `http://localhost:5173`)가 포함되어 있는지 확인하세요.
- **405/404 오류**: `VITE_GEMINI_PROXY_URL` 환경변수 또는 Firebase Hosting의 rewrite 경로가 올바른지 확인하세요.
- **500 오류**: 백엔드 로그에서 에러 메시지를 확인하세요.
