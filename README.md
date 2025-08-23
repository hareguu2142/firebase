# Gemini Proxy React App

Firebase Hosting에 배포할 수 있는 Vite + React 예제입니다.  
백엔드는 사용자가 제공한 `geminiProxy`(Cloud Run Functions / Cloud Functions 2nd gen) 엔드포인트를 사용합니다.

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
# 그리고 URL을 채워넣으세요
```

Firebase Hosting에서 **rewrite**를 구성하면 `/api/gemini`로도 접근할 수 있습니다.
이 프로젝트는 환경변수를 우선 사용하며, 미설정 시 `/api/gemini` 경로를 시도합니다.

### (선택) Firebase Hosting rewrite 예시
`firebase.json` 내 `hosting.rewrites`에 아래 중 하나를 추가하세요.

**Cloud Run 서비스로 라우팅**:
```json
{
  "source": "/api/gemini",
  "run": { "serviceId": "gemini-proxy", "region": "asia-northeast3" }
}
```

**Functions 2nd gen로 라우팅**:
```json
{
  "source": "/api/gemini",
  "function": { "functionId": "geminiProxy", "region": "asia-northeast3" }
}
```

> 실제 `serviceId` / `functionId` / `region`은 프로젝트에 맞게 변경하세요.

## 3) 실행
```bash
npm i
npm run dev
# http://localhost:5173
```

## 4) 프로덕션 빌드
```bash
npm run build
npm run preview
```

생성된 정적 파일은 `dist/`에 위치합니다.

## 5) Firebase Hosting 배포
```bash
firebase init hosting
# - 'existing project' 선택
# - 'public directory'로 dist 입력
# - SPA routing(Y/N)은 자유롭게
# 필요시 rewrites 설정 추가

npm run build
firebase deploy --only hosting
```

## 6) 스트리밍 주의사항
- 백엔드가 **POST + text/event-stream**을 사용하므로, 브라우저에서는 `EventSource` 대신 `fetch`의 ReadableStream으로 처리합니다.
- 현재 서버 구현상 스트리밍 요청에서는 `history`가 사용되지 않습니다. (단발 프롬프트만 전송)

## 7) 문제해결
- CORS 오류: 백엔드 `ALLOWED_ORIGINS`에 현재 호스트가 포함되어 있는지 확인
- 405/404: 프록시 URL 또는 Hosting rewrite 경로 확인
- 500: 백엔드 로그에서 에러 메시지를 확인 (`console.error` 존재)