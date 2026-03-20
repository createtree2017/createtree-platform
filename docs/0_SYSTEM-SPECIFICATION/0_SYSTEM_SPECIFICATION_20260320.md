# 창조AI V2 - 종합 시스템 명세서
**버전:** 3.2  
**작성일:** 2026년 3월 20일  
**문서 상태:** Production Ready  
**이전 버전:** v3.1 (2026-02-23)

---

## 1. 시스템 개요

### 1.1 프로젝트 소개
창조AI V2는 산후조리원 및 산부인과 병원을 위한 AI 기반 문화센터 플랫폼입니다. 최신 버전에서는 **전용 안드로이드 네이티브 앱 배포(Capacitor 8.x 기반)**, UI/UX 전면 개편, 글로벌 모달 연동, 그리고 백엔드 AI 모델(Gemini 3.1) 최신화 및 관리자용 병원 필터 프리패스 시스템이 안정적으로 반영되었습니다.

### 1.2 핵심 기능 요약 (최신판)
| 기능 | 설명 | 상태 |
|------|------|------|
| 네이티브 안드로이드 앱 | Capacitor 기반 네이티브화, 자동 에셋(아이콘/스플래시) 젠레이트, AAB 플레이스토어 정식 배포 | Production |
| 멀티 AI 모델 파이프라인 | Gemini 3.1 Flash / 3.0 Pro 중심, OpenAI(GPT-Image-1) 폴백 연계 구조 | Production |
| 하단 글래스모피즘 네비게이션 | 중앙 돌출형 FAB 설계 및 사용자 좌우 균형 레이아웃 오토매칭 | Production |
| 관리자 프리패스(Superadmin) | 전역 병원 미션 통합 조회 및 필터링 기능 / 권한 강제 우회 탐색 기능 | Production |
| AI 음악/업스케일/배경 제거 | TopMediai, Vertex AI Imagen, HuggingFace BiRefNet 파이프라인 통합 | Production |
| 제작소 및 통합 갤러리 | 전역 모달과 통합된 Fabric.js 기반 에디터 및 갤러리 다운로드 인프라 | Production |

### 1.3 핵심 기술 및 패키지 스택 업데이트
```text
Frontend:
├── React 18 + TypeScript + Vite 5 + SWC
├── Tailwind CSS + shadcn/ui (UI 기본기)
├── Framer Motion (애니메이션, 팝업/모달 글로벌화 적용)
└── Capacitor 8 (@capacitor/android, @capacitor/assets, @capacitor/push-notifications)

Backend:
├── Node.js (v20) + Express.js + Neon Serverless WebSocket (PostgreSQL)
├── Drizzle ORM + Zod Validation
├── JWT Auth + Session 병합 (Token Refresh 파이프라인 최적화)
└── Sentry + 에러 멀티티어 폴백 라우팅 적용

AI Services & Cloud Integrations:
├── Firebase 11.7.1 클라이언트 SDK & Admin SDK 13.x (Storage CORS 완벽 제어)
├── Google GenAI v1.34 SDK (gemini-3.1-flash-image-preview 네이티브 도입)
├── OpenAI GPT-Image-1 (v4.104 SDK)
└── Anthropic SDK (추후 확장을 위한 의존성 포함)
```

---

## 2. 아키텍처 및 코어 시스템 고도화 (v3.2 신규)

### 2.1 안드로이드 앱 (Capacitor) 통합 및 배포 환경
- **AAB 빌드 파이프라인 확립**: `npm run build` 및 `npx capacitor sync android` 과정을 통해 웹 자원을 네이티브로 넘기며, Android Studio JDK 17 / Gradle 9.x 체계로 컴파일되는 과정을 정립.
- **자동 에셋 관리**: `@capacitor/assets` 플러그인을 활용해 고해상도 앱 런처 아이콘(1024x1024) 및 스플래시 이미지의 디바이스별(ldpi ~ xxxhdpi 등 총 74개) 자동 분해 및 생성을 구현.
- **플레이스토어 프로세스 관리**: 서명된 번들(Signed Bundle `.aab`)을 패키징하고, 현재 구글 플레이 콘솔 비공개 테스트 트랙을 통한 즉석 사용자 테스트 환경 배포 라인을 확정.

### 2.2 AI 모델 마이그레이션 및 데이터베이스 자동 동기화
- **Gemini 모델 체인지**: 기존 경제형 `gemini-2.5-flash-image` 모델을 폐기하고, 최신 `gemini-3.1-flash-image-preview` 모델로 완전히 대체. (식별자: `gemini_3_1`)
- **자동 DB 마이그레이션**: 서버 재시작 시 `settings.ts`에서 시스템 세팅 테이블(`system_settings`)과 컨셉 테이블(`concepts`) 내에 잔존하는 기존 `gemini` 식별자를 `gemini_3_1`로 1회성 자동 스왑. 별도의 SQL 마이그레이션 스크립트 작성 부담을 제거함.
- **OpenAI 보수적 롤백 운영**: API 권한 제약/에러 문제로 인해, 추가 시도되었던 `gpt-image-1.5` 및 경제형 `gpt-image-1-mini` 모델의 도입을 전면 철회하고, 안정성이 입증된 **`gpt-image-1`**으로 시스템을 복원하여 가용성을 최우선적으로 확보.

### 2.3 최고관리자(Superadmin) 권한 체계 재편: 프리패스 도입
- **UI 필터 기반 전환**: 과거 JWT 자체에 `viewingHospitalId`를 덮어씌워 가상으로 병원을 스위칭하는 구조(로그아웃 우회 방식)가 혼동을 주어 폐기됨. 이를 대신해 **문화센터 전용 전역 병원 드롭다운 필터**를 구현하여 최고관리자는 상단에서 즉시 모든 병원의 데이터를 셀렉트/오버뷰 가능.
- **강제 진입 예외 개방 (Free Pass)**: Superadmin은 `isActive=false`인 미션, 선행 조건(조상/형제 미션 완료 필수 조건)이 걸려있는 미션, 심지어 타 병원에 귀속된 미션 상세 페이지에도 **모든 권한 필터를 무시하고 100% 진입, 조회, 수정**할 수 있도록 API 레벨 예외 가드(Bypass)를 적용 완성.

---

## 3. 프론트엔드 UI/UX 개편

### 3.1 글래스모피즘 기반 하단 네비게이션 시스템
- **플로팅 오퍼레이션 버튼(FAB)**: 일반 메뉴들 사이에 존재하는 'AI 생성' 버튼을 네비게이션 바 상단으로 30px 돌출시켜 사용성을 극대화. 
- **Auto-Balancing 레이아웃**: 메뉴 수가 변동(ex. "나의미션" 메뉴 숨김 등 4개 ↔ 5개)하더라도 중앙 FAB을 기준으로 좌우 메뉴들이 균등한 여백(`justify-around`)을 유지하며 자동으로 레이아웃이 정렬되는 래퍼 로직을 구성.
- **시각 디자인 고도화**: 두꺼운 보라색 활성형 버튼 배경을 탈피하여, 매우 얇고 투명한 유리 질감의 글래스모피즘(Backdrop-blur 20px, rgba 반사광 테두리)을 적용해 모던하고 몰입도 높은 뷰를 제공.

### 3.2 갤러리 통합 및 모달 중앙화
- **전역 모달 매니저**: 하위 컴포넌트별로 산재되었던 모달 컴포넌트들을 최상단(Zustand State) 단일 관리 체계로 묶어(`N_전역모달통합`) 모바일 뒤로가기 대응 및 오버레이 충돌 문제를 해결.
- **히스토리 + 문화센터 통합**: 파편화되었던 유저의 제출 기록(히스토리 탭) 로직을 메인 "문화센터" 메뉴 섹션 내로 깔끔하게 편입/병합시켜 사용자 동선을 최적화함.

---

## 4. 인프라스트럭처 제언 및 한계점 대처 전략

### 4.1 Neon Serverless DB 타임아웃 방어 기제
- **서버리스 슬립 모노폴리(Timeout) 주의**: Neon DB는 연결 유입이 없을 시 즉각 슬립(Sleep) 전환됨. 이 상태에서 CLI 툴(`npx tsx`, `drizzle-kit` 직접 실행 등)로 외부에서 직접 WebSocket DB를 타격하면 과도한 연결 지연 및 타임아웃 크래시가 빈번하게 발생함.
- **운영팀 필수 지침**: DB 데이터 수정 작업 시 절대 VSC 터미널 단독 스크립트 실행으로 찌르지 말 것. 반드시 기동 중인 `npm run dev` Express 서버의 **운영 API 엔드포인트를 호출**하거나 **내장된 최고관리자 어드민 UI**를 통해 데이터 수정을 수행하여 타임아웃 한계를 방어해야 함.

### 4.2 PDCA 및 에이전트 워크플로우 (Stitch MCP 활용)
- 개발 에이전트(Antigravity)용 **Single Source of Truth** 규칙을 고도화하여, 어떠한 상황에서도 1순위 코드베이스, 2순위 GEMINI.md, 3순위 docs/ 규칙을 철저히 엄수하는 `.agent` 기반 프롬프트 체인을 고도화 중.
- 특히 `docs/05-devlog/`를 통한 모든 코드 변이 1건당 1개의 인수인계 문서를 자동 작성하는 플로우를 정착시켜 휴먼 에러 추적이 가능해짐.
- 프론트엔드 스캐폴딩 보조를 위해 원격 Stitch MCP 연동 등을 도입 고려.

---

## 5. 결론 및 향후 로드맵
v3.2는 앱스토어 정식 등록을 위한 **안드로이드 네이티브 파이프라인의 완성**과 사용자 앱 진입 시 최초 경험치를 끌어올린 **네비게이션 UI, 최신 AI 3.1 모델 이식**에 성공한 메이저 업데이트 릴리즈입니다.

기다리고 있는 구글 프로덕션 승인이 완료되면 추가 작업 없이 현재 구축된 AAB 번들 시스템의 '버전 승급'만으로 수많은 실 서비스 유저에게 곧장 서비스 롤아웃이 가능합니다.

---

**문서 작성자:** Antigravity AI Agent  
**최종 검토/업데이트 일시:** 2026년 3월 20일
