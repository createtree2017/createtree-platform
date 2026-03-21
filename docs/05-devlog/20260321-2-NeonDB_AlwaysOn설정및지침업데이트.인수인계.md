# 인수인계: Neon DB Always-On 설정 및 GEMINI.md 지침 업데이트

- **작업일**: 2026-03-21
- **작업자**: AI (Antigravity)

---

## 1. 작업 내용

### Neon DB 환경 변경 (대시보드에서 수동 진행)
- Neon Free Plan → **Launch Plan** 업그레이드
- **createtree-platform**: Scale to Zero **OFF** (Always-On)
- **createtree-office**: Scale to Zero **OFF** (Always-On)
- Compute defaults: Scale to zero **disabled** 설정

### GEMINI.md DB 접근 규칙 업데이트
- 기존 "⚠️ DB 직접 접근 규칙 (중요)" → "✅ DB 접근 규칙 (Neon Launch Plan — Always-On 환경)" 교체
- 파일 기반 스크립트(`npx tsx scripts/파일.ts`) 허용으로 변경
- `npx tsx -e` 인라인만 금지 (CJS top-level await 미지원 문제)
- DB 작업 방법 4단계 우선순위 명시
- 스크립트 작성 템플릿 추가

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `GEMINI.md` | DB 접근 규칙 섹션 교체 (157~171줄 → 157~217줄) |

---

## 3. 동작 확인

| 항목 | 상태 |
|------|:---:|
| `npx tsx scripts/db-test.ts` 실행 | ✅ 성공 (413명, 1092ms) |
| Neon Always-On 설정 | ✅ production 브랜치 Active 상태 확인 |
| GEMINI.md 업데이트 | ✅ 완료 |

---

## 4. 참고사항

- **Neon Launch Plan 예상 월 비용**: ~$19~20/월 (0.25 CU Always-On 기준)
- **import-2026-02-11T02:04:...** 브랜치는 불필요 → 삭제 가능 (비용 절약)
- `npx tsx -e "..."` 인라인이 안 되는 건 Neon과 무관한 **Node.js CJS 문법 제한**
- 장기적으로 Railway PostgreSQL 마이그레이션 검토 가능 (Neon 의존 제거)

---

## 5. 개발 전용 자동 로그인 엔드포인트 구현

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `server/routes/dev-login.ts` | **[NEW]** 개발 전용 자동 로그인 라우트 |
| `server/routes.ts` | dev-login 라우터 import 및 `/api/dev` 경로 등록 |

### 기능 설명
- `GET /api/dev/auto-login` → 관리자 계정으로 자동 로그인 (JWT + 세션 + 쿠키 발급)
- `GET /api/dev/auth-status` → 현재 로그인 상태 확인 (디버깅용)
- `NODE_ENV !== 'production'` 가드 → 프로덕션에서는 절대 활성화 안 됨

### 사용 방법
- 브라우저에서 `localhost:5000/api/dev/auto-login` 접속 → 자동 로그인 후 메인 페이지 리다이렉트
- AI 에이전트 브라우저 테스트 시 첫 번째 단계로 이 URL 방문

### 동작 확인

| 항목 | 상태 |
|------|:---:|
| 자동 로그인 성공 (superadmin, ID: 24) | ✅ |
| 메인 페이지 리다이렉트 | ✅ |
| 세션/쿠키 유지 (auth_status=logged_in) | ✅ |
| 프로덕션 차단 (NODE_ENV 가드) | ✅ |
