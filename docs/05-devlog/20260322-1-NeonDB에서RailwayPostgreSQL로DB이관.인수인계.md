# 20260322-1-NeonDB에서RailwayPostgreSQL로DB이관 인수인계

## 작업 개요
- **목적**: Neon DB(월 ~$19) → Railway PostgreSQL로 데이터베이스 완전 이관
- **결과**: 63개 테이블 전량 이관 완료 + 코드 드라이버 변경 + 프로덕션 배포 완료

## 변경 파일 목록

### 핵심 변경 (서비스 영향)
| 파일 | 변경 내용 |
|------|----------|
| `db/index.ts` | `@neondatabase/serverless` → `pg` 표준 드라이버로 변경. `neonConfig` 제거, SSL 조건부 설정 추가 |
| `.env` | `DATABASE_URL`을 Railway DB URL로 변경. 기존 Neon URL은 주석으로 백업 |
| `package.json` | `pg`, `@types/pg` 패키지 추가 |

### 문서 업데이트
| 파일 | 변경 내용 |
|------|----------|
| `GEMINI.md` | DB 접근 규칙: Neon → Railway로 변경, 스크립트 템플릿 `pg` 드라이버로 교체, 프로덕션 테스트 계정 추가 |
| `docs/0_SYSTEM-SPECIFICATION/0_SYSTEM_SPECIFICATION_20260320.md` | v3.2→v3.3 버전업, 기술스택/인프라섹션 Railway PG로 변경 |
| `.agent/workflows/migrate-db-to-railway.md` | 오피스 사이트 등 타 프로젝트 이관용 워크플로우 커맨드 신규 작성 |

### 신규 파일 (마이그레이션 도구 — 정리 대상)
| 파일 | 용도 |
|------|------|
| `drizzle.railway.config.ts` | Railway DB용 drizzle-kit 설정 (스키마 push용) |
| `scripts/migrate-to-railway.ts` | Neon→Railway 데이터 복사 스크립트 (일회성) |
| `scripts/check-nan.ts` | user_settings NaN 진단 스크립트 (일회성) |
| `scripts/verify-migration.ts` | 마이그레이션 전수검사 스크립트 |

## 핵심 변경 내용

### 1. db/index.ts 드라이버 변경
```diff
-import { Pool, neonConfig } from '@neondatabase/serverless';
-import { drizzle } from 'drizzle-orm/neon-serverless';
-import ws from "ws";
+import { Pool } from "pg";
+import { drizzle } from "drizzle-orm/node-postgres";
```
- Neon WebSocket 전용 드라이버 → 표준 TCP PostgreSQL 드라이버
- Railway PostgreSQL은 표준 PostgreSQL이므로 필수 변경

### 2. Railway 환경변수
- Railway 대시보드에서 `DATABASE_URL = ${{Postgres.DATABASE_URL}}` 설정
- Railway 내부 네트워크 URL로 자동 해석 (낮은 지연시간, 무료 통신)

### 3. 데이터 마이그레이션 결과
- 63개 테이블 전량 복사 ✅
- 1건 무효 데이터 제외: user_settings (user_id='NaN')
- 스키마 불일치 컬럼 자동 건너뜀 (레거시 컬럼)
- 시퀀스(auto-increment) 복원 완료

### 4. 실제 DB 규모 (2026.03.22 기준)
| 테이블 | 행 수 |
|--------|-------|
| users | **413명** (membership 390, free 13, superadmin 7, pro 2, hospital_admin 1) |
| images | 4,091행 |
| concepts | 101행 |
| sub_mission_submissions | 333행 |
| hospitals | 9행 |
| user_settings | 25행 |

## 동작 확인 상태
- ✅ 로컬 서버 (`npm run dev`) Railway DB로 정상 기동
- ✅ 브라우저 메인 페이지 데이터 로딩 정상
- ✅ 전수검사 22/23 항목 통과
- ✅ git push → develop 브랜치 push (commit: d0480d7)
- ✅ **develop → main PR 머지 → Railway 자동 배포 완료**
- ✅ **프로덕션 사이트 로그인 정상 확인** (9059056@gmail.com 계정)
- ✅ **프로덕션 브라우저 전체 테스트 통과** (메인/문화센터/갤러리/MY/관리자 페이지)
- ✅ **프로덕션 API 6개 직접 호출 검증 완료**
- ✅ **코드 레벨 Neon 잔여 의존성 없음** (메인 코드 기준)
- ✅ **GEMINI.md / 시스템 스펙 문서 Railway로 현행화 완료**

## 프로덕션 배포 이슈 및 해결
- **증상**: PR 머지 전 프로덕션 500 에러 (로그인 불가)
- **원인**: Railway DB URL은 변경했으나 이전 코드(Neon WebSocket 드라이버)가 실행 중
- **해결**: develop → main PR 머지 → 새 코드(표준 pg 드라이버)가 배포되며 즉시 해결

## 비용 영향
| 항목 | 이전 | 이후 |
|------|------|------|
| Neon Launch Plan | ~$19/월 | **$0** (해지 예정) |
| Railway Hobby Plan | $5/월 (서버만) | $5/월 + 사용량 초과분 (서버+DB) |
| **예상 총 비용** | **~$24/월** | **~$10~20/월** |

## 다음 작업 참고사항
1. ~~프로덕션 사이트 확인~~ → **완료 ✅**
2. ~~GEMINI.md 업데이트~~ → **완료 ✅**
3. ~~시스템 스펙 문서 업데이트~~ → **완료 ✅**
4. **Neon DB 유료 플랜 해지** — 프로덕션 정상 확인 완료, 즉시 해지 가능
5. **레거시 코드 정리** — `package.json`의 `@neondatabase/serverless`, 마이그레이션 스크립트들 삭제 (선택)
6. **오피스 사이트 DB 이관** — `/migrate-db-to-railway` 워크플로우 커맨드 사용

