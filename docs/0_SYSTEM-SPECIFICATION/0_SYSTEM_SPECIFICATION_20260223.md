# 창조AI V2 - 종합 시스템 명세서
**버전:** 3.1  
**작성일:** 2026년 2월 23일  
**문서 상태:** Production Ready  
**이전 버전:** v3.0 (2026-02-11)

---

## 1. 시스템 개요

### 1.1 프로젝트 소개
창조AI V2는 산후조리원 및 산부인과 병원을 위한 AI 기반 문화센터 플랫폼입니다. 임산부와 가족들에게 AI 음악 생성, AI 이미지 변환, AI 스냅샷 생성, 제작소(포토북/엽서/파티), 미션 시스템 등 다양한 창작 서비스를 제공합니다. 최근 오프라인 환경 고려(PWA 개선) 및 자체 PDCA 워크플로우 시스템 체계화를 완료하여 더욱 안정적인 운영 및 유지보수 환겸을 구축했습니다.

### 1.2 핵심 기능 요약
| 기능 | 설명 | 상태 |
|------|------|------|
| AI 음악 생성 | TopMediai API 기반 맞춤형 태교 음악 생성 | Production |
| AI 이미지 변환 | 이미지 스타일 변환 및 캐릭터 생성 | Production |
| AI 스냅샷 | 3개 AI 모델, 420개 프롬프트 기반 인물 사진 생성 | Production |
| 제작소 시스템 | 포토북/엽서/파티 에디터 (Fabric.js 기반) | Production |
| 미션 시스템 | 스타벅스 프리퀀시 모델 기반 슬롯형 미션 (문화센터) | Production |
| AI 채팅 | 페르소나 기반 대화형 AI 상담 | Production |
| 갤러리 | 생성된 콘텐츠 통합 관리 및 다운로드 | Production |
| 이미지 업스케일 | Google Vertex AI Imagen 기반 고해상도 변환 | Production |
| 배경 제거 | BiRefNet-portrait-ONNX 기반 누끼 처리 | Production |

### 1.3 기술 스택
```
Frontend:
├── React 18 + TypeScript
├── Vite 5 (빌드 도구)
├── TanStack Query v5 (서버 상태 관리)
├── Wouter (라우팅)
├── Tailwind CSS + shadcn/ui (UI 컴포넌트)
├── Lucide React (아이콘)
├── Framer Motion (애니메이션)
├── Zustand (클라이언트 상태 관리)
└── Fabric.js (캔버스 에디터)

Backend:
├── Node.js + Express.js
├── TypeScript (ESM 모듈)
├── Drizzle ORM (데이터베이스)
├── JWT + Cookie 인증
├── Multer (파일 업로드)
├── Sharp (이미지 처리)
└── Winston (로깅)

Database:
├── PostgreSQL (Neon Serverless - 자체 계정 관리)
└── Drizzle Kit (마이그레이션)

Cloud Services:
├── Google Cloud Storage (파일 저장)
├── Firebase Admin SDK (GCS 인증 + Custom Token)
├── Firebase Storage (클라이언트 직접 업로드 및 에러 시 서버 폴백)
├── Google Vertex AI (이미지 업스케일)
└── Sentry (에러 모니터링)

Deployment:
├── Railway (프로덕션 호스팅, GitHub Push 자동 배포)
├── esbuild (서버 번들링, --packages=external)
├── Custom Domain: createtree.ai.kr (Gabia DNS)
└── NeonDB: createtree-platform (US West 2, Oregon)

AI Services:
├── TopMediai API (음악 생성)
├── OpenAI GPT-Image-1 (이미지 생성)
├── Google Gemini 2.5 Flash / 3.0 Pro (이미지 생성)
├── Google Vertex AI Imagen (이미지 업스케일)
├── HuggingFace BiRefNet-portrait-ONNX (배경 제거)
└── OpenAI GPT-4o (가사 생성, 분석)
```

---

## 2. 프로젝트 구조

### 2.1 디렉토리 구조
```
/
├── client/                     # 프론트엔드
│   ├── src/
│   │   ├── components/         # React 컴포넌트
│   │   ├── hooks/              # 커스텀 훅 (25개)
│   │   ├── lib/                # 유틸리티 (firebase, pwa 등)
│   │   ├── pages/              # 페이지 컴포넌트 (Admin 포함)
│   │   ├── services/           # 프론트엔드 서비스 (exportService 등)
│   │   ├── stores/             # Zustand 스토어
│   │   ├── types/              # TypeScript 타입 정의
│   │   └── App.tsx             # 메인 앱
│   ├── public/sw.js            # 서비스 워커 (networkFirst 캐시 전략)
│   └── index.html
│
├── server/                     # 백엔드
│   ├── routes/                 # 라우터 모듈 (32개)
│   ├── services/               # 비즈니스 로직 (20+개)
│   ├── middleware/             # 미들웨어
│   ├── utils/                  # 유틸리티
│   ├── routes.ts               # 통합 라우터
│   └── index.ts                # 서버 진입점
│
├── shared/                     # 공유 모듈
│   ├── schema.ts               # DB 스키마 (55개 테이블)
│   └── constants.ts            # 공통 상수
│
├── db/                         # 데이터베이스
│   ├── index.ts                # DB 연결
│   └── seed.ts                 # 시드 데이터
│
├── docs/                       # PDCA 문서 (Plan/Design/Check/Report)
│
├── .agent/workflows/           # Antigravity Native PDCA 슬래시 커맨드 워크플로우
└── GEMINI.md                   # 프로젝트 룰 (Single Source of Truth 2순위)
```

### 2.2 PDCA 기반 개발 워크플로우 시스템
Antigravity 에이전트 네이티브 기능을 활용해 체계적이고 단계적인 개발 프로세스를 구축했습니다. (v3.1 신규)
* **Single Source of Truth**: 1. 코드베이스 → 2. GEMINI.md → 3. docs/ 설계 문서
* **슬래시 커맨드 워크플로우**: `/plan`, `/design`, `/check`, `/report`, `/status`, `/review` 등의 커맨드를 통한 규격화된 문서 생산 및 검증 체계 도입.

---

## 3. 백엔드 아키텍처 (주요 사항)

- 라우터 모듈 32개, 6단계 멤버십(free ~ superadmin) 및 Role 기반 접근제어
- Image Processing (TopMediai, Vertex AI, HuggingFace 등 연동)
- Firebase Storage CORS 적용 및 업로드 폴백 설계로 업로드 안정성 확보

---

## 4. 데이터베이스 스키마

- **총 55개 테이블** (사용자/인증, 병원 관리, 콘텐츠 생성, 컨셉 및 스타일, 페르소나, 마일스톤, 미션 시스템, A/B 테스트, UI 관리, 알림 시스템, 시스템 설정, 포토북 및 제품 시스템 등)
- *주요 스키마 업데이트*:
  - `main_menus`를 통한 메뉴 표시 설정 고도화
  - `sub_missions`에 studio_submit 타입, studioDpi 옵션 지원 확장

---

## 5. 프론트엔드 아키텍처 및 시스템 상세

### 5.1 PWA (Progressive Web App) 캐시 시스템 최적화
- **서비스 워커 전략 변경**: iOS 환경 구버전 고착 이슈 해결을 위해 캐시 버전을 정기 업데이트하고, `.js`, `.css` 에셋의 정책을 `cacheFirst`에서 `networkFirst`로 변경.
- **업데이트 프로세스 강화**: 사용자가 탭 변경 등을 통해 앱 귀환 시 `visibilitychange` 이벤트로 구버전 감지 → updatefound 시 "새 버전이 있습니다" 토스트 → SKIP_WAITING를 통해 새 서비스 워커 자동 활성화 및 새로고침 진행.

### 5.2 제작소 시스템 결합 및 최적화
- **Admin Tab 및 My Page 동기화**: `MenuManagement` 컴포넌트 고도화를 통해 마이페이지에서도 관리자 패널의 메뉴 사용 여부(활성화/비활성화)가 동적으로 연동 반영.
- **Admin 대시보드 구조화**: `admin.tsx` 내에서 탭 순서를 실무 편의에 맞게 재정렬 (메뉴 표시 설정을 마일스톤의 하위 섹션으로 이동시키는 등 통합화).

### 5.3 미션 시스템 고도화 및 엑셀 포맷 최적화
- **엑셀 반출 양식 고도화**: ми션 제출 내역의 단일 `제출내용`을 `제출형식`과 `내용` 두 개 열로 분리, 슬롯 별 줄바꿈 명확화, 리뷰 필터에 제외할 `별점` 요소 제거 등 출력물 관리성 극대화.
- **히스토리 통계 정확도 개선**: `My Missions` > `History` 탭에서 유저가 직접 서브 미션을 하나라도 제출한 기록만 보이도록 데이터 호출 조건 조정 수행.
- **메뉴명 개편**: 네비게이션바의 "미션"을 "문화센터"로 수정 탑재 완료.

---

## 6. 보안

### 6.1 방어 메커니즘
- JWT / 쿠키, bcrypt, express-rate-limit, Helmet, CSP 정책 등 기존 체계 지속 유지.
- Firebase Direct Upload에 대한 CORS 오류 완전 해결, 클라이언트 업로드 실패 시 Multi-tier 처리로 백엔드 폴백 구조 적용 및 안정성 강화.

---

## 7. 성능 최적화

### 7.1 데이터베이스 구조화 지수
- Drizzle with() 활용 Relation Join 최적화 및 듀얼 해상도(preview, original) 분리 저장 로직을 통해 갤러리 로딩 및 브라우저 메모리 부하 제어.
- PWA `networkFirst`를 통해 프런트엔드 애플리케이션의 TTI(상호작용 한계 시간) 확보와 버전 릴리즈 충돌 이슈 99% 해소.

---

## 8. 변경 이력

### 2026년 2월 23일 (v3.1) — 성능 최적화 및 PDCA 도입
- 🆕 PWA 캐시 메커니즘 전면 개편 (`networkFirst`, SKIP_WAITING을 통한 iOS 구버전 화면 이슈 등 해결)
- 🆕 Antigravity Native PDCA 개발 프로세스 도입 (`GEMINI.md`, 워크플로우 커맨드 `.agent/workflows/` 구축)
- 🆕 Firebase Storage CORS 이슈 수정 및 클라이언트 업로드 안정성 극대화
- 미션 히스토리 데이터 통계 쿼리 정밀화 (실제 제출 분만 검증 및 표기)
- 관리자 화면 탭 정렬 최적화 및 메인 메뉴 활성화 상태의 마이페이지 연동 로직 적용
- 관리자 패널 엑셀 내보내기 포맷 편의성 개선 (컬럼 분할, 별점 삭제)
- "미션" 메뉴 → "문화센터" 워딩 수정

### 2026년 2월 11일 (v3.0) — Railway 완전 마이그레이션
- 인프라 마이그레이션 (Replit → Docker/Railpack Railway 환경 전면 마이그레이션)
- Firebase Direct Upload 활성화 및 서비스 안정성/속도 개선
- Vite import 런타임 분리 및 ESM 모듈 캡처 안정성 증대

---

## 9. 환경 변수 및 배포 방식 (v3.0과 동일)

- 배포 방식: Github Trigger → Railway (Docker 빌드 툴체인)
- 주요 환경 변수: DATABASE_URL, JWT_SECRET, GCS 설정, API_KEYS (OPENAI, GEMINI, TOPMEDIA, VERTEX, HUGGINGFACE 등)

---

**문서 작성자:** Antigravity AI Agent  
**최종 검토일:** 2026년 2월 23일
