# createTree 개발 시스템 규칙

> AI와의 체계적인 개발을 위한 PDCA 기반 워크플로우 규칙
> 프로젝트: createTree AI 콘텐츠 플랫폼

---

## 1. 프로젝트 컨텍스트

### 플랫폼 개요
- **createTree**: AI 기반 콘텐츠 생성(이미지, 음악, 태명) + 문화센터 미션 시스템
- **배포 환경**: Railway (Production)

### 기술 스택
| 영역 | 기술 |
|------|------|
| Frontend | React + TypeScript + Vite + TanStack Query |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Drizzle ORM) |
| Storage | Firebase Storage / GCS |
| Auth | JWT + 세션 기반 |

### 주요 디렉토리
```
client/src/          # React 프론트엔드
server/              # Express 백엔드
shared/              # 공유 타입/스키마
db/                  # Drizzle DB 스키마
docs/                # PDCA 문서
.agent/workflows/    # 슬래시 커맨드 워크플로우
```

---

## 2. PDCA 워크플로우 규칙

### 자동 적용 규칙

| 요청 유형 | AI 행동 |
|-----------|---------|
| 새 기능 요청 | `docs/02-design/` 확인 → 없으면 Plan/Design 먼저 권장 |
| 버그 수정 | 코드 분석 → 수정 → 변경 요약 제공 |
| 리팩토링 | 현재 분석 → Plan → 설계 업데이트 → 실행 |
| 구현 완료 | 갭 분석(`/check`) 제안 |

### 작업 분류 및 PDCA 수준

| 분류 | 변경 규모 | PDCA 수준 | 행동 |
|------|----------|-----------|------|
| Quick Fix | < 10줄 | 불필요 | 즉시 실행 |
| Minor Change | < 50줄 | 선택 | 요약 제공 후 진행 |
| Feature | < 200줄 | 권장 | Plan/Design 권장, 사용자 확인 |
| Major Feature | ≥ 200줄 | 필수 | Plan/Design 필수, 사용자 승인 후 진행 |

### 분류 키워드
- **Quick Fix**: fix, typo, 오타, 수정, 조정
- **Minor Change**: improve, refactor, 개선, 리팩토링, 최적화
- **Feature**: add, create, implement, 추가, 구현, 새 기능
- **Major Feature**: redesign, migrate, 재설계, 마이그레이션, 전면 수정

### 사용 가능한 워크플로우 커맨드

| 커맨드 | 설명 | PDCA 단계 |
|--------|------|-----------|
| `/plan {feature}` | 계획서 작성 | Plan |
| `/design {feature}` | 설계 문서 작성 | Design |
| `/check {feature}` | 갭 분석 (설계 vs 구현 비교) | Check |
| `/report {feature}` | 완료 보고서 생성 | Act |
| `/status` | 프로젝트 PDCA 현황 대시보드 | - |
| `/review {file}` | 코드 리뷰 및 품질 분석 | Check |

---

## 3. SoR (Single Source of Truth) 우선순위

```
1순위: 코드베이스 (실제 동작하는 코드)
2순위: GEMINI.md (이 파일의 규칙)
3순위: docs/ 설계 문서
```

- 모르는 것은 추측하지 않고 문서 확인 → 문서에도 없으면 사용자에게 질문
- 기존 코드 패턴을 우선 따름

---

## 4. 코드 품질 규칙

### 핵심 원칙
- **DRY**: 동일 로직이 2번 나타나면 공통 함수로 추출
- **SRP**: 하나의 함수는 하나의 책임
- **하드코딩 금지**: 의미 있는 상수로 정의
- **확장성**: 일반화된 패턴으로 작성

### 코딩 전 체크
1. 유사 기능이 이미 존재하는지 검색 (utils/, hooks/, components/ui/)
2. 존재하면 재사용, 없으면 새로 생성
3. 기존 코드 패턴과 일관성 유지

### 리팩토링 시점
- 동일 코드가 2번째 등장할 때
- 함수가 20줄을 초과할 때
- if-else 중첩이 3단계 이상일 때
- 동일 매개변수가 여러 함수에 전달될 때

### TypeScript 규칙
- `any` 타입 사용 최소화, 구체적 타입 정의
- 인터페이스/타입은 `shared/` 또는 해당 모듈에 정의
- API 응답 타입은 서버-클라이언트 공유

### React 규칙
- 컴포넌트는 함수형 컴포넌트만 사용
- 상태 관리: TanStack Query (서버 상태) + useState/useReducer (로컬 상태)
- 커스텀 훅으로 비즈니스 로직 분리
- 조건부 훅 호출 금지

### Express 규칙
- 라우트 핸들러에 try-catch 필수
- 에러는 중앙 에러 핸들러로 전달
- 인증 미들웨어 사용 패턴 준수
- 입력 검증은 라우트 핸들러 초입에서 수행

### Drizzle ORM 규칙
- 스키마 변경 시 마이그레이션 파일 생성 인지
- 복잡한 쿼리는 서비스 레이어에서 처리
- 트랜잭션 사용 시 에러 롤백 보장

---

## 5. 문서 규칙

### PDCA 문서 저장 위치
```
docs/
├── 01-plan/features/{feature}.plan.md       # 계획서
├── 02-design/features/{feature}.design.md   # 설계서
├── 03-analysis/{feature}.analysis.md        # 갭 분석 결과
└── 04-report/features/{feature}.report.md   # 완료 보고서
```

### 상세 개발 스펙 문서
- 위치: `docs/1_Detailed-Development-Specifications/`
- 파일명 규칙: `1-{YYYYMMDD}-{기능요약_영문대문자}.md`
- 주요 기능 변경 시 여기에도 문서 작성 권장

### 시스템 스펙 문서
- 위치: `docs/0_SYSTEM-SPECIFICATION/`
- 전체 시스템 아키텍처 변경 시에만 업데이트

---

## 6. 응답 규칙

### 작업 완료 시
- 변경된 파일 목록과 변경 내용 요약 제공
- Feature 이상의 작업은 다음 PDCA 단계 안내

### 커뮤니케이션
- 한국어 기본 (코드/기술 용어는 영어 유지)
- 간결하고 핵심적인 설명
- 초보 개발자가 이해할 수 있는 수준으로 설명
- 추측하지 않고, 불확실하면 질문

---

*createTree PDCA 개발 시스템 v1.0 — Antigravity Native*
