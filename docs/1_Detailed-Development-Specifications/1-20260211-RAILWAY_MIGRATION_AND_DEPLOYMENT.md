# 🚀 Replit → Railway 배포 마이그레이션 - 개발 결과 보고서

**작업 일시**: 2026-02-10 ~ 2026-02-11  
**작업 시간**: 약 4시간  
**상태**: ✅ **완료 — Railway 배포 정상 작동 확인**

---

## 📋 목차

1. [개요 및 배경](#1-개요-및-배경)
2. [핵심 개념 설명](#2-핵심-개념-설명)
3. [발견된 문제 및 해결 과정](#3-발견된-문제-및-해결-과정)
4. [수정된 파일 목록](#4-수정된-파일-목록)
5. [장단점 분석](#5-장단점-분석)
6. [착각하기 쉬운 부분 (주의사항)](#6-착각하기-쉬운-부분-주의사항)
7. [향후 개선점](#7-향후-개선점)
8. [결론](#8-결론)

---

## 1. 개요 및 배경

### 무엇을 했는가?

기존 Replit에서 운영하던 "AI 우리병원 문화센터" 플랫폼을 **Railway**로 이전하고, 발생하는 **502 Bad Gateway 에러**를 해결하여 정상 배포에 성공한 작업.

### 왜 필요했는가?

| 항목 | Replit | Railway |
|------|--------|---------|
| **비용** | 유료 플랜 필요 (월 $7~$20+) | 무료 티어 제공 (월 $5 크레딧) |
| **성능** | 콜드 스타트 느림 | 항시 가동 가능 |
| **배포 방식** | Replit 전용 IDE 필요 | GitHub Push → 자동 배포 |
| **환경 제어** | 제한적 | Docker 기반 완전 제어 |
| **커스텀 도메인** | 유료 기능 | 무료 제공 |

### 배포 아키텍처 변화

```
[기존 - Replit]
GitHub → Replit (빌드+실행) → *.replit.app 도메인
         └ devDependencies 포함 환경
         └ PORT=5000 고정
         └ Replit 전용 플러그인 사용

[현재 - Railway]
GitHub → Railway (Railpack 기반 Docker 빌드) → *.railway.app 도메인
         └ 프로덕션 최적화 환경
         └ PORT=8080 (Railway 자동 할당)
         └ Replit 종속성 완전 제거
```

---

## 2. 핵심 개념 설명

### 2-1. esbuild 번들링과 `--packages=external`

**esbuild란?**
- TypeScript 서버 코드를 JavaScript로 변환하고 하나의 파일로 합치는(번들링) 도구
- `npm run build` 시 `dist/index.js` (1.1MB) 생성

**`--packages=external` 옵션이란?**
- npm 패키지(node_modules)는 번들에 포함하지 **않고**, 런타임에 `import`로 로딩
- 로컬 소스 파일(server/*.ts)만 번들에 포함

```
[번들링 결과]
dist/index.js 안에 포함되는 것:
  ✅ server/index.ts (메인 서버)
  ✅ server/routes.ts (라우트)
  ✅ server/vite.ts (유틸리티)
  ✅ 기타 server/ 소스 파일들

dist/index.js에서 import만 남는 것 (런타임 로딩):
  📦 express, passport, openai, bcrypt...
  📦 @sentry/node, @google-cloud/storage...
  ⚠️ vite (devDependency!) ← 여기서 문제 발생
```

> ⚠️ **핵심**: 런타임에 `import`되는 패키지는 반드시 `node_modules`에 존재해야 함. devDependency는 프로덕션에서 제거될 수 있음!

### 2-2. Railway의 빌드/실행 분리

```
[Railway 빌드 단계]
npm ci            → node_modules 설치 (devDeps 포함)
npm run build     → vite build + esbuild → dist/ 생성
                    이 시점에 devDeps 사용 가능

[Railway 실행 단계]
node dist/start.js → dist/index.js import
                     이 시점에 필요한 패키지가 node_modules에 있어야 함
```

### 2-3. Content Security Policy (CSP)

**CSP란?**
- 브라우저가 웹페이지에서 로딩할 수 있는 리소스를 제한하는 보안 정책
- 서버가 HTTP 헤더로 "이 페이지에서는 이 출처의 리소스만 로딩해라"라고 지시

```
[CSP가 없으면]
해커가 악성 스크립트를 삽입해도 브라우저가 실행함

[CSP가 있으면]
서버: "script는 'self'에서만 허용"
브라우저: "외부 스크립트? 차단!"
```

**문제**: CSP가 너무 엄격하면 정상적인 리소스(Google Fonts, CDN 폰트 등)도 차단됨

### 2-4. PORT 환경변수와 Networking

```
[Railway의 PORT 동작 방식]
1. Railway가 PORT=8080을 자동 할당
2. 앱이 process.env.PORT를 읽어서 8080에서 listen
3. Railway의 reverse proxy가 외부 HTTPS 트래픽을 내부 8080으로 전달
4. Networking 설정의 "Port"는 이 전달 대상 포트를 의미

[포트 불일치 시]
Railway proxy → 포트 5000으로 전달
앱 → 포트 8080에서 대기
결과 → 연결 실패 → 502 Bad Gateway!
```

---

## 3. 발견된 문제 및 해결 과정

### 문제 1: 서버 시작 후 502 Bad Gateway (초기 증상)

**증상**: Railway 배포 성공, "Active" 상태이지만 모든 HTTP 요청이 502 반환

**Deploy Logs 분석**:
```
✅ [Sentry] 초기화 완료 - DSN 설정됨
📊 [Sentry] 환경: production
✅ GCS 클라이언트 초기화 완료
[Sentry] express is not instrumented...
(여기서 로그 끊김 - 서버가 "serving on port" 출력 안 함)
```

Sentry와 GCS는 초기화되지만, **서버가 listen 시작 메시지를 출력하지 않음** → 초기화 중 어딘가에서 조용히 크래시

---

### 문제 2: devDependency `vite`가 프로덕션 번들에 포함 (근본 원인 1)

**원인 분석 과정**:

1. `server/vite.ts`에서 `vite` 패키지를 모듈 최상위에서 import
2. esbuild가 `--packages=external`로 빌드하므로 `import { createServer } from "vite"` 가 번들에 남음
3. Railway 런타임에서 `vite`를 찾을 수 없어 **서버 즉시 크래시** (에러 메시지 없음)

**1차 수정**: `vite.ts`에서 Vite 관련 import를 `setupVite()` 함수 안으로 이동 (동적 import)

```diff
- import { createServer, createLogger } from "vite";
- import viteConfig from "../vite.config";

+ export async function setupVite(app, server) {
+   const viteModule = await import("vite");
+   const viteConfig = (await import("../vite.config")).default;
```

**하지만 이것만으로는 부족했음!** ❌

---

### 문제 3: esbuild가 동적 import도 번들에 포함 (근본 원인 2)

**증상**: 1차 수정 후에도 Deploy Logs 동일, 여전히 502

**원인**:
```bash
# dist/index.js 분석 결과
Select-String -Path dist/index.js -Pattern 'from "vite"|from "@vitejs'

LineNumber Line
---------- ----
      6748 import { defineConfig } from "vite";         ← 여전히 존재!
      6749 import react from "@vitejs/plugin-react";    ← 여전히 존재!
```

esbuild는 `await import("../vite.config")`를 **정적 분석**하여 `vite.config.ts`를 번들에 포함시킴.
`vite.config.ts`는 최상위에서 `import { defineConfig } from "vite"`와 `import react from "@vitejs/plugin-react"` 사용.

**해결**: 런타임에 경로를 동적으로 구성하여 esbuild가 정적 분석할 수 없게 함

```diff
- const viteModule = await import("vite");
- const viteConfig = (await import("../vite.config")).default;
- const { nanoid } = await import("nanoid");

+ const vitePkg = "vite";
+ const viteModule = await import(/* @vite-ignore */ vitePkg);
+ const configPath = path.resolve(import.meta.dirname, "..", "vite.config.ts");
+ const viteConfig = (await import(/* @vite-ignore */ configPath)).default;
+ const nanoidPkg = "nanoid";
+ const { nanoid } = await import(/* @vite-ignore */ nanoidPkg);
```

**검증**:
```bash
# 수정 후 dist/index.js 분석 → vite import 완전 제거 확인
Select-String -Path dist/index.js -Pattern 'from "vite"|from "@vitejs'
# (결과 없음 ✅)
```

**교훈**: esbuild의 `--packages=external`은 npm 패키지만 외부화하고, **로컬 파일 import는 정적 분석하여 번들에 포함**. 동적 import라도 경로가 문자열 리터럴이면 분석 대상이 됨.

---

### 문제 4: 에러가 보이지 않아 디버깅 불가

**증상**: 서버가 크래시해도 Deploy Logs에 에러 메시지가 전혀 없음

**원인**: ESM 모듈의 최상위 import 실패 시 Node.js가 에러를 stderr로 출력하지만, Railway의 로그 수집기가 프로세스 종료 직전의 출력을 캡처 못할 수 있음

**해결**: `server/start.ts` 에러 캐치 래퍼 생성

```typescript
// 글로벌 에러 핸들러 설정
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  console.error('❌ Stack:', err.stack);
  process.exit(1);
});

// 메인 모듈을 동적 import로 로드 (에러 캡처 가능)
try {
  await import('./index.js');
  console.log('✅ Main module loaded successfully');
} catch (err) {
  console.error('❌ MODULE LOAD ERROR:', err.message);
  process.exit(1);
}
```

`package.json` 변경:
```diff
- "build": "vite build && esbuild server/index.ts --platform=node ...",
- "start": "NODE_ENV=production node dist/index.js",
+ "build": "vite build && esbuild server/index.ts server/start.ts --platform=node ...",
+ "start": "NODE_ENV=production node dist/start.js",
```

**성과**: 래퍼 덕분에 다음 문제(PORT 불일치)를 즉시 발견

```
🔧 [WRAPPER] PORT: 8080    ← 이 정보가 핵심이었음!
```

**교훈**: 프로덕션에서는 반드시 **에러 캐치 래퍼**를 사용할 것. ESM 모듈 로딩 실패는 일반 try-catch로 잡히지 않음.

---

### 문제 5: PORT 불일치 — 502 Bad Gateway의 직접 원인

**증상**: 래퍼 로그에서 `PORT: 8080` 확인, 하지만 Railway Networking은 포트 5000으로 설정됨

**원인**:
```
Railway가 할당한 PORT: 8080
앱이 listen하는 포트: 8080 (process.env.PORT 사용 → 정상)
Railway Networking 설정: 5000 (reverse proxy가 5000으로 트래픽 전달)

결과: proxy → 5000 전달, 앱 → 8080 대기 = 연결 실패 = 502!
```

**해결**: Railway 대시보드에서 Networking 포트를 **5000 → 8080**으로 변경

**교훈**: Railway에서는 앱의 listen 포트와 Networking 설정의 포트를 **반드시 일치**시켜야 함. `process.env.PORT`를 사용하면 Railway가 자동 할당하는 포트와 맞출 수 있음.

---

### 문제 6: Content Security Policy (CSP) 에러 대량 발생

**증상**: 배포 성공 후 페이지는 로드되지만 콘솔에 수십 개의 CSP 에러

**차단된 리소스 목록**:

| 리소스 | CSP 지시어 | 차단 이유 |
|--------|-----------|----------|
| Pretendard 폰트 (cdn.jsdelivr.net) | `style-src` | jsdelivr.net 미허용 |
| Spoqa Han Sans (cdn.jsdelivr.net) | `style-src` | jsdelivr.net 미허용 |
| Google Fonts woff2 (fonts.gstatic.com) | `connect-src` | fonts.gstatic.com 미허용 |
| Replit 배지 스크립트 | `script-src` | replit.com 미허용 |
| Firebase 연결 (*.firebaseio.com) | `connect-src` | 미허용 |

**해결**: `server/middleware/security.ts`의 CSP 설정 확장

```diff
  styleSrc: [
    "'self'", "'unsafe-inline'", "https://fonts.googleapis.com",
+   "https://cdn.jsdelivr.net",
  ],
  fontSrc: [
    "'self'", "https://fonts.gstatic.com",
+   "https://cdn.jsdelivr.net",
  ],
  connectSrc: [
    "'self'", "https://api.openai.com", ...
+   "https://fonts.googleapis.com",
+   "https://fonts.gstatic.com",
+   "https://cdn.jsdelivr.net",
+   "https://*.firebaseio.com",
+   "https://*.googleapis.com",
+   "https://*.sentry.io",
+   "wss://*.firebaseio.com",
  ],
+ workerSrc: ["'self'", "blob:"],
```

**추가**: Replit 잔여물 제거
```diff
  <!-- client/index.html -->
- <script>/* @replit/vite-plugin-runtime-error-modal 폴리필 */</script>
- <script src="https://replit.com/public/js/replit-badge-v3.js"></script>
```

**교훈**: 보안 미들웨어를 도입할 때는 앱에서 사용하는 **모든 외부 리소스**를 CSP에 포함해야 함.

---

## 4. 수정된 파일 목록

| 파일 | 변경 내용 | 중요도 |
|------|---------|--------|
| `server/vite.ts` | Vite import를 런타임 동적 경로로 변경 (esbuild 번들 제외) | ⭐⭐⭐⭐⭐ (근본 원인) |
| `server/start.ts` | 에러 캐치 래퍼 (모듈 로딩 에러 캡처) | ⭐⭐⭐⭐ (디버깅 핵심) |
| `server/middleware/security.ts` | CSP에 외부 리소스 도메인 허용 추가 | ⭐⭐⭐ |
| `server/index.ts` | 디버그 부팅 로그 추가 (BOOT Step 1~5) | ⭐⭐ (디버깅용) |
| `client/index.html` | Replit 배지 스크립트 & 폴리필 제거 | ⭐⭐ |
| `package.json` | build에 start.ts 포함, start를 start.js로 변경 | ⭐⭐⭐⭐ |

---

## 5. 장단점 분석

### ✅ Railway 배포의 장점

| 항목 | 설명 |
|------|------|
| **자동 배포** | GitHub push → 자동 빌드 & 배포 (3~4분) |
| **Docker 기반** | 일관된 환경, 로컬과 프로덕션 차이 최소화 |
| **무료 티어** | 월 $5 크레딧으로 소규모 서비스 운영 가능 |
| **Deploy Logs** | 실시간 로그 확인, 에러 추적 용이 |
| **환경변수 관리** | 대시보드에서 쉬운 환경변수 CRUD |
| **HTTPS 자동** | SSL 인증서 자동 발급/갱신 |

### ⚠️ 주의사항

| 항목 | 설명 |
|------|------|
| **무료 한도** | 월 $5 크레딧, 500시간 — 24시간 운영 시 20일 정도 |
| **냉간 시작** | 무료 티어에서 비활성 시 앱 중지될 수 있음 |
| **빌드 캐시** | Railpack의 캐시가 때로는 오래된 코드를 사용할 수 있음 |
| **PORT 관리** | Railway가 PORT를 자동 할당하므로 하드코딩하면 안 됨 |
| **devDeps 주의** | `--packages=external` 사용 시 devDependency가 런타임에 없을 수 있음 |

---

## 6. 착각하기 쉬운 부분 (주의사항)

### ❌ 착각 1: "동적 import는 esbuild가 무시한다"

**실제**: esbuild는 `await import("../vite.config")` 같은 동적 import도 **정적 분석**하여 번들에 포함시킴. 경로가 문자열 리터럴이면 분석 대상.

```javascript
// ❌ esbuild가 분석하여 번들에 포함
await import("../vite.config");

// ✅ esbuild가 분석 불가 → 번들에서 제외
const configPath = path.resolve(import.meta.dirname, "..", "vite.config.ts");
await import(/* @vite-ignore */ configPath);
```

### ❌ 착각 2: "devDependency는 개발 환경에서만 import되니까 괜찮다"

**실제**: esbuild가 소스 코드를 번들링할 때, 함수 안에 있건 밖에 있건 **정적 분석으로 발견된 모든 import를 처리**. 개발 전용 함수 안에 있어도, esbuild 번들에는 import가 포함됨.

```javascript
// ❌ setupVite()는 개발에서만 호출되지만, esbuild가 "vite"를 번들에 포함
export async function setupVite() {
  const vite = await import("vite");  // 문자열 리터럴 → esbuild 분석 대상
}

// ✅ 변수를 통해 경로 구성 → esbuild 분석 불가
export async function setupVite() {
  const pkg = "vite";
  const vite = await import(pkg);  // 변수 → esbuild 무시
}
```

### ❌ 착각 3: "502 에러 = 서버가 안 시작된 것"

**실제**: 502는 "서버에 연결할 수 없음"을 의미. 이는 다음 중 하나:
1. 서버가 크래시하여 프로세스가 종료됨
2. 서버는 실행 중이지만 **다른 포트에서 대기** (PORT 불일치!)
3. 서버가 시작 중이나 아직 준비되지 않음 (초기화 지연)

이번 사례에서는 **1과 2가 동시에** 존재했음.

### ❌ 착각 4: "Railway 무료 버전이라 안 되는 것"

**실제**: Railway 무료 티어는 리소스 제한(CPU/메모리)이 있지만, **기능 차이는 없음**. "Active" 상태로 빌드/배포가 완료된다면 무료 제한이 원인이 아님. 코드에 문제를 찾아야 함.

### ❌ 착각 5: "Replit 코드를 Railway에 그대로 배포할 수 있다"

**실제**: Replit 환경에는 다음과 같은 고유한 특성이 있어, 그대로 옮기면 문제 발생:

| Replit 고유 요소 | Railway에서의 문제 |
|------------------|-------------------|
| `@replit/vite-plugin-*` | devDependency인데 번들에 포함될 수 있음 |
| Replit 배지 스크립트 | CDN 로딩 차단 (CSP) |
| `REPL_ID` 환경변수 | 존재하지 않음 |
| 포트 5000 고정 | PORT 환경변수 사용 필요 |
| devDeps가 항상 설치됨 | 프로덕션에서 제거될 수 있음 |

### ❌ 착각 6: "console.log를 추가하면 에러를 볼 수 있다"

**실제**: ESM 모듈의 최상위 import가 실패하면, 파일의 **어떤 코드도 실행되지 않음**. console.log가 import 뒤에 있으면 절대 실행 안 됨.

```javascript
// dist/index.js (esbuild 번들)
import { defineConfig } from "vite";   // ← 여기서 실패
import express from "express";
// ... 수천 줄의 번들 코드 ...
console.log('🚀 [BOOT] 시작!');         // ← 절대 실행 안 됨!
```

**해결**: 별도의 wrapper 파일(`start.ts`)에서 **동적 import + try-catch**로 에러 캡처

---

## 7. 향후 개선점

### 7-1. 디버그 로그 정리

현재 `server/index.ts`에 `🚀 [BOOT] Step 1~5` 디버그 로그가 남아있음. 배포 안정화 후 제거하거나, 로그 레벨로 관리할 것.

### 7-2. Replit 잔여 코드 완전 제거

다음 파일에 Replit 관련 코드가 남아있을 수 있음:
- `vite.config.ts`: `REPL_ID` 조건부 import (동작에는 지장 없지만 불필요)
- devDependencies의 `@replit/vite-plugin-*` 패키지들

### 7-3. Railway 모니터링 설정

- Sentry의 `--import` 방식 초기화 적용 (현재 경고 발생 중)
- Health check 엔드포인트 추가 (`/api/health`)
- Railway의 Observability 기능 활용

### 7-4. 커스텀 도메인 연결

현재 `createtree-platform-production.up.railway.app` 사용 중. 자체 도메인이 있다면 Railway Networking에서 연결 가능.

### 7-5. 환경변수 정리

Railway Variables에 다음 값 확인 필요:
- `PRODUCTION_DOMAIN`: Railway 도메인으로 업데이트
- `PHOST`, `PPORT`: Replit 전용이라면 제거 검토

---

## 8. 결론

### 디버깅 타임라인

```
[Phase 1] 초기 분석 (30분)
  └ 502 에러 확인 → Deploy Logs 분석 → "serving on port" 없음 발견

[Phase 2] 1차 수정 — vite.ts 동적 import (30분)
  └ 서버 코드 분석 → vite import 문제 발견 → 동적 import로 변경
  └ 결과: ❌ 여전히 502

[Phase 3] 번들 분석 (20분)
  └ dist/index.js 내용 분석 → vite.config.ts가 번들에 포함됨 발견
  └ 2차 수정: 런타임 경로 구성으로 esbuild 분석 회피
  └ 결과: ❌ 여전히 502 (하지만 번들에서 vite 제거 확인)

[Phase 4] 에러 캐치 래퍼 (30분)
  └ start.ts 래퍼 생성 → 모듈 로딩 에러 캡처 설정
  └ Deploy Logs에서 PORT: 8080 발견!
  └ Railway Networking 포트를 8080으로 변경
  └ 결과: ✅ 502 해결!

[Phase 5] CSP & Replit 정리 (30분)
  └ CSP 에러 대량 발생 → security.ts에 외부 도메인 추가
  └ Replit 배지 & 폴리필 코드 제거
  └ CORS에 Railway 도메인 추가
  └ 결과: ✅ 에러 해결!
```

### 핵심 성과

1. ✅ **Railway 배포 정상 작동** — 502 에러 완전 해결
2. ✅ **esbuild devDependency 문제 근본 해결** — 번들에서 vite 완전 제거
3. ✅ **에러 디버깅 인프라 구축** — start.ts 래퍼로 향후 Module Load Error 즉시 파악 가능
4. ✅ **CSP 보안 정책 적절히 설정** — 외부 리소스 허용하면서 보안 유지
5. ✅ **Replit 의존성 제거** — 배지, 폴리필, Replit 전용 코드 정리
6. ✅ **CORS 설정 Railway 적응** — Railway 도메인 추가

### Git 커밋 이력

| 커밋 | 설명 |
|------|------|
| `6e7b4aa` | vite.ts에서 Vite import를 동적 import로 변경 (1차 수정) |
| `db5b37e` | index.ts에 BOOT 디버그 로그 추가 |
| `6d04afc` | esbuild가 vite를 번들하지 못하게 런타임 경로 구성 (2차 수정) |
| `35869db` | start.ts 에러 캐치 래퍼 추가, package.json 수정 |
| `72ef40e` | CSP 설정 확장, Replit 잔여물 제거 |

---

**완료 일시**: 2026-02-11 03:33  
**작성자**: AI Assistant  
**배포 URL**: https://createtree-platform-production.up.railway.app  
**관련 파일**: `server/vite.ts`, `server/start.ts`, `server/middleware/security.ts`, `server/index.ts`, `client/index.html`, `package.json`
