# 🚀 Replit → Railway 완전 마이그레이션 - 개발 결과 보고서

**작업 일시**: 2026-02-10 ~ 2026-02-11  
**작업 시간**: 약 6시간  
**상태**: ✅ **완료 — Railway 배포 + 도메인 + DB 이전 + Replit 해지**

---

## 📋 목차

1. [개요 및 배경](#1-개요-및-배경)
2. [핵심 개념 설명](#2-핵심-개념-설명)
3. [발견된 문제 및 해결 과정](#3-발견된-문제-및-해결-과정)
4. [도메인 마이그레이션](#4-도메인-마이그레이션)
5. [NeonDB 데이터베이스 이전](#5-neondb-데이터베이스-이전)
6. [수정된 파일 목록](#6-수정된-파일-목록)
7. [장단점 분석](#7-장단점-분석)
8. [착각하기 쉬운 부분 (주의사항)](#8-착각하기-쉬운-부분-주의사항)
9. [현재 인프라 구성](#9-현재-인프라-구성)
10. [결론](#10-결론)

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

## 4. 도메인 마이그레이션

### 4-1. 커스텀 도메인 연결 (createtree.ai.kr)

**작업**: Replit에 연결되어 있던 커스텀 도메인 `createtree.ai.kr`을 Railway로 이전

**DNS 변경 (Gabia 도메인 관리)**:

| 레코드 | 기존 (Replit) | 변경 후 (Railway) |
|--------|-------------|------------------|
| CNAME | `*.replit.app` | Railway 제공 CNAME 값 |

**Railway 설정**:
1. Railway Networking → Custom Domain에 `createtree.ai.kr` 추가
2. Railway가 제공하는 CNAME 값을 Gabia DNS에 등록
3. SSL 인증서 자동 발급 확인

**주의사항**: Replit에서 도메인을 먼저 해제해야 SSL 충돌이 발생하지 않음

### 4-2. CORS 설정 업데이트

`server/middleware/security.ts`의 `productionCORS`에 Railway 도메인 추가:

```typescript
const allowedOrigins = [
  process.env.PRODUCTION_DOMAIN || 'https://ai-culture-center.replit.app',
  'https://createtree-platform-production.up.railway.app',
  'https://localhost:3000',
];
```

### 4-3. 비밀번호 재설정 URL 수정

`server/routes/auth.ts`에서 비밀번호 재설정 이메일의 URL이 Replit 도메인을 사용하고 있었음:

```diff
- const resetUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/reset-password?token=${resetToken}`;
+ const domain = process.env.PRODUCTION_DOMAIN || 'https://createtree.ai.kr';
+ const cleanDomain = domain.replace(/\/$/, '');
+ const resetUrl = `${cleanDomain}/reset-password?token=${resetToken}`;
```

**Railway 환경변수**: `PRODUCTION_DOMAIN=https://createtree.ai.kr`

---

## 5. NeonDB 데이터베이스 이전

### 5-1. 배경

기존 NeonDB 인스턴스는 **Replit이 자동 프로비저닝**한 것으로, Replit 구독 해지 시 **데이터 삭제 위험**이 있었음.

| 항목 | 기존 (Replit 관리) | 변경 후 (자체 관리) |
|------|-------------------|--------------------|
| **계정** | Replit 내부 | 창조드리 Neon 계정 |
| **프로젝트** | Replit 자동 생성 | `createtree-platform` |
| **리전** | US West 2 (Oregon) | US West 2 (Oregon) |
| **데이터** | ~64MB, ~60 테이블 | 동일 (Import 완료) |
| **엔드포인트** | `ep-plain-fog-a6ibz9a6` | `ep-wandering-term-ako0hi2m` |

### 5-2. 이전 절차

1. **새 Neon 프로젝트 생성**: `createtree-platform` (Free tier)
2. **Neon Import 기능 사용**: 대시보드 → Import Data → 기존 DB 연결 문자열 입력
3. **호환성 체크 통과** → **Start Import** 실행
4. **Import 브랜치 생성**: `import-2026-02-11T02:04:16.262Z`
5. **데이터 검증**: Tables 목록에서 전체 테이블 확인

### 5-3. 환경변수 업데이트

**Railway Variables** 및 **로컬 `.env`** 모두 업데이트:

| 변수 | 기존 값 | 새 값 |
|------|--------|------|
| `DATABASE_URL` | `...@ep-plain-fog-a6ibz9a6.us-west-2...` | `...@ep-wandering-term-ako0hi2m.c-3.us-west-2...` |
| `PGHOST` | `ep-plain-fog-a6ibz9a6.us-west-2.aws.neon.tech` | `ep-wandering-term-ako0hi2m.c-3.us-west-2.aws.neon.tech` |
| `PGPASSWORD` | `npg_v3gibUQqJP6j` | `npg_ZjrNQe7CY2JI` |

### 5-4. 검증 결과

- ✅ 사이트 정상 접속 (`createtree.ai.kr`)
- ✅ 관리자 로그인 정상
- ✅ 검수 대시보드 데이터 정상 표시 (11건 제출 확인)
- ✅ 사용자 데이터 정상 (이름, 전화번호, 제출일시 등)

### 5-5. Replit 구독 해지

- **플랜**: Replit Core ($25/month)
- **해지**: 구독 취소 (갱신 중단)
- **만료일**: 2026-02-25까지 사용 가능
- **영향받는 앱**: 창조AI_우리병원문화센터, 창조AI_랜딩페이지, 창조AI_CMP
- **대응**: 문화센터는 Railway로 이전 완료. 나머지 2개는 파일 다운로드 후 별도 이전 예정

---

## 6. 수정된 파일 목록

| 파일 | 변경 내용 | 중요도 |
|------|---------|--------|
| `server/vite.ts` | Vite import를 런타임 동적 경로로 변경 (esbuild 번들 제외) | ⭐⭐⭐⭐⭐ (근본 원인) |
| `server/start.ts` | 에러 캐치 래퍼 (모듈 로딩 에러 캡처) | ⭐⭐⭐⭐ (디버깅 핵심) |
| `server/middleware/security.ts` | CSP 확장 + CORS에 Railway/createtree.ai.kr 도메인 추가 | ⭐⭐⭐ |
| `server/routes/auth.ts` | 비밀번호 재설정 URL을 `PRODUCTION_DOMAIN` 사용으로 변경 | ⭐⭐⭐ |
| `server/index.ts` | 디버그 부팅 로그 추가 (BOOT Step 1~5) | ⭐⭐ (디버깅용) |
| `client/index.html` | Replit 배지 스크립트 & 폴리필 제거 | ⭐⭐ |
| `package.json` | build에 start.ts 포함, start를 start.js로 변경 | ⭐⭐⭐⭐ |
| `.env` | DB 연결 정보를 새 NeonDB 계정으로 업데이트 | ⭐⭐⭐ |

---

## 7. 장단점 분석

### ✅ Railway 배포의 장점

| 항목 | 설명 |
|------|------|
| **자동 배포** | GitHub push → 자동 빌드 & 배포 (3~4분) |
| **Docker 기반** | 일관된 환경, 로컬과 프로덕션 차이 최소화 |
| **무료 티어** | 월 $5 크레딧으로 소규모 서비스 운영 가능 |
| **Deploy Logs** | 실시간 로그 확인, 에러 추적 용이 |
| **환경변수 관리** | 대시보드에서 쉬운 환경변수 CRUD |
| **HTTPS 자동** | SSL 인증서 자동 발급/갱신 + 커스텀 도메인 무료 |

### ⚠️ 주의사항

| 항목 | 설명 |
|------|------|
| **무료 한도** | 월 $5 크레딧, 500시간 — 24시간 운영 시 20일 정도 |
| **냉간 시작** | 무료 티어에서 비활성 시 앱 중지될 수 있음 |
| **빌드 캐시** | Railpack의 캐시가 때로는 오래된 코드를 사용할 수 있음 |
| **PORT 관리** | Railway가 PORT를 자동 할당하므로 하드코딩하면 안 됨 |
| **devDeps 주의** | `--packages=external` 사용 시 devDependency가 런타임에 없을 수 있음 |

---

## 8. 착각하기 쉬운 부분 (주의사항)

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

## 9. 현재 인프라 구성

마이그레이션 완료 후 최종 인프라:

```
[서비스 아키텍처]
사용자 → createtree.ai.kr (Gabia DNS)
      → Railway (서버 호스팅, SSL, 리버스 프록시)
      → NeonDB (PostgreSQL - 자체 계정)
      → Firebase Storage (이미지 업로드)
      → Google Cloud (AI API, 업스케일러)
```

| 서비스 | 용도 | 비용 |
|--------|------|------|
| **Railway** | 서버 호스팅 | 월 $5 크레딧 (무료 티어) |
| **NeonDB** | PostgreSQL DB | 무료 (Free tier, 0.5GB) |
| **Gabia** | 도메인 (createtree.ai.kr) | 연간 도메인비 |
| **Firebase** | 스토리지, 인증 토큰 | 무료 (Spark plan) |
| **Google Cloud** | AI API, GCS | 사용량 과금 |

---

## 10. 결론

### 전체 마이그레이션 타임라인

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

[Phase 6] 도메인 마이그레이션 (30분)
  └ createtree.ai.kr DNS를 Railway CNAME으로 변경
  └ Replit에서 도메인 해제, Railway에서 SSL 발급
  └ 비밀번호 재설정 URL의 REPLIT_DOMAINS → PRODUCTION_DOMAIN 수정
  └ 결과: ✅ 커스텀 도메인 정상 작동!

[Phase 7] NeonDB 이전 (30분)
  └ 자체 Neon 계정에 createtree-platform 프로젝트 생성
  └ Neon Import 기능으로 레플릿 관리 DB → 자체 DB 이전 (64MB)
  └ Railway 환경변수 + 로컬 .env 업데이트
  └ 결과: ✅ DB 이전 완료, 사이트 정상 동작 확인!

[Phase 8] Replit 해지 (10분)
  └ Replit Core 구독 취소 (2026-02-25 만료)
  └ 나머지 2개 앱 파일 사전 다운로드 완료
  └ 결과: ✅ Replit 의존성 완전 해제!
```

### 핵심 성과

1. ✅ **Railway 배포 정상 작동** — 502 에러 완전 해결
2. ✅ **esbuild devDependency 문제 근본 해결** — 번들에서 vite 완전 제거
3. ✅ **에러 디버깅 인프라 구축** — start.ts 래퍼로 향후 Module Load Error 즉시 파악 가능
4. ✅ **CSP 보안 정책 적절히 설정** — 외부 리소스 허용하면서 보안 유지
5. ✅ **커스텀 도메인 연결** — `createtree.ai.kr` Railway에서 정상 서비스
6. ✅ **NeonDB 자체 관리 전환** — 레플릿 종속 DB에서 자체 계정으로 64MB 전량 이전
7. ✅ **비밀번호 재설정 URL 수정** — Replit 도메인 → PRODUCTION_DOMAIN 환경변수
8. ✅ **Replit 완전 독립** — 구독 해지, 호스팅·도메인·DB 모두 자체 관리

### Git 커밋 이력

| 커밋 | 설명 |
|------|------|
| `6e7b4aa` | vite.ts에서 Vite import를 동적 import로 변경 (1차 수정) |
| `db5b37e` | index.ts에 BOOT 디버그 로그 추가 |
| `6d04afc` | esbuild가 vite를 번들하지 못하게 런타임 경로 구성 (2차 수정) |
| `35869db` | start.ts 에러 캐치 래퍼 추가, package.json 수정 |
| `72ef40e` | CSP 설정 확장, Replit 잔여물 제거 |
| — | 도메인 마이그레이션 (CORS, 비밀번호 재설정 URL) |
| — | NeonDB 이전 (환경변수 업데이트) |

---

**완료 일시**: 2026-02-11 11:30  
**작성자**: AI Assistant  
**서비스 URL**: https://createtree.ai.kr  
**Railway URL**: https://createtree-platform-production.up.railway.app  
**DB**: NeonDB `createtree-platform` (ep-wandering-term-ako0hi2m)  
**관련 파일**: `server/vite.ts`, `server/start.ts`, `server/middleware/security.ts`, `server/routes/auth.ts`, `server/index.ts`, `client/index.html`, `package.json`, `.env`
