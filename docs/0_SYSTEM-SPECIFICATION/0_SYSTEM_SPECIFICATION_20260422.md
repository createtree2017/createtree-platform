# 창조AI V2 - 종합 시스템 명세서

**버전:** 3.5  
**작성일:** 2026년 4월 22일  
**최종 수정일:** 2026년 4월 22일  
**문서 상태:** Production Ready  
**이전 버전:** v3.3 (2026-03-22)

---

## 1. 시스템 개요

### 1.1 프로젝트 소개
창조AI V2는 산후조리원 및 산부인과 병원을 위한 AI 기반 문화센터 플랫폼입니다. v3.5에서는 **FCM 네이티브 푸시 알림 시스템**, **자동 푸시 Rule Engine**, **다중 보상 시스템**, **리워드 선물 신청/관리**, **이메일 발송 엔진 교체(Resend)**, **액션 타입 동적 아이콘화** 등 프로덕션 수준의 대규모 기능 확충이 이루어졌습니다.

### 1.2 핵심 기능 요약 (최신판)

| 기능 | 설명 | 상태 |
|------|------|------|
| 네이티브 안드로이드 앱 | Capacitor 8 기반, AAB 플레이스토어 배포, 앱 이름 "AI문화센터" | Production |
| FCM 푸시 알림 시스템 | 2-Phase 토큰 동기화, Error-Isolated 청크 발송, 좀비 토큰 24h GC | Production |
| 자동 푸시 Rule Engine | Trigger-Audience-Payload-Toggle 구조, 관리자 UI 규칙 CRUD | Production |
| 사용자 알림함 | 마이페이지 무한 스크롤 알림함, Red Dot 뱃지, 바텀 모달 상세보기 | Production |
| 다중 보상(리워드) 시스템 | JSONB 기반 복수 선물, 리워드 선물 신청/관리자 검수 프로세스 | Production |
| 액션 타입 동적 아이콘 | Lucide 50종 한/영 검색 선택기, DB iconUrl 기반 탭바 동적 렌더링 | Production |
| 멀티 AI 모델 파이프라인 | Gemini 3.1 Flash 중심, OpenAI GPT-Image-1 폴백 | Production |
| 관리자 프리패스(Superadmin) | 전역 병원 드롭다운 필터, 모든 권한 필터 무시 진입 | Production |
| 이메일 발송 (Resend) | SMTP→HTTP API 전환, Railway SMTP 차단 우회, SPF/DKIM/DMARC 설정 | Production |
| 메인 메뉴 동적 설명란 | 관리자 설정 → 프론트엔드 타이틀 하단 안내문구 동적 반영 | Production |

### 1.3 기술 스택

```text
Frontend:
├── React 18 + TypeScript 5.6 + Vite 5 + SWC
├── Tailwind CSS 3.4 + shadcn/ui (Radix UI 기반)
├── Framer Motion (성장 애니메이션, 모달)
├── Zustand 5 (전역 상태/모달 매니저)
├── TanStack Query 5 (서버 상태, useInfiniteQuery 무한스크롤)
├── vaul (바텀 시트/Drawer 모달)
├── @dnd-kit (드래그앤드롭 미션 정렬)
├── lucide-react 0.453 (아이콘 시스템)
└── Capacitor 8 (@capacitor/android, @capacitor/push-notifications)

Backend & Infrastructure:
├── Node.js v20 + Express.js 4.21
├── Railway PostgreSQL (pg ^8.20 표준 TCP, Always-On)
├── Drizzle ORM 0.38 (node-postgres) + Zod 3.23
├── JWT + express-session + connect-pg-simple (세션 스토어)
├── Resend ^6.12 (이메일 발송 — Railway SMTP 차단 대응)
├── firebase-admin ^13.4 (FCM 서버 발송 + Storage)
├── Sentry ^10.21 (에러 모니터링, ESM --import 구조)
├── winston ^3.18 (로깅)
├── sharp ^0.34 (이미지 리사이징)
└── xlsx ^0.18 + jspdf ^4.0 (엑셀/PDF 내보내기)

AI Services:
├── @google/genai ^1.34 (gemini-3.1-flash-image-preview)
├── OpenAI ^4.104 (GPT-Image-1)
├── @google-cloud/storage ^7.16 (GCS 이미지 저장)
└── Firebase 11.7.1 Client SDK (Storage CORS)
```

---

## 2. 인프라 및 아키텍처 변경 (2026.03.20 ~ 04.22)

### 2.1 Railway PostgreSQL 완착
- **Neon → Railway 이관 완료** (2026.03.22): 63개 테이블, 6,922행 전량 이관
- 콜드스타트 타임아웃 0% 달성, 표준 `pg` TCP 드라이버 사용
- 비용: Neon ~$19/월 제거 → Railway $5~20/월로 통합 절감

### 2.2 이메일 엔진 교체 — Nodemailer → Resend (2026.04.17)
- **원인**: Railway 클라우드가 SMTP 포트(25/465/587) 아웃바운드를 차단하여 Nodemailer로 Gmail SMTP 발송 불가
- **해결**: Resend SDK(HTTP API, 443포트)로 전면 교체. 함수 시그니처 100% 유지
- **DNS 보안**: 가비아 도메인에 SPF, DKIM, DMARC 레코드 4건 추가 → 네이버/다음 수신 정상화
- **환경변수**: `RESEND_API_KEY` 추가 필요 (Railway Variables + .env)

### 2.3 Sentry ESM 구조 개선 (2026.03.27)
- `package.json` dev 스크립트: `tsx --import ./server/instrument.ts server/index.ts`
- Express 자동 계측(auto-instrumentation) 경고 해결
- 서버 시작 시 Private Key 콘솔 노출 보안 이슈 제거

### 2.4 환경변수 정리 (2026.03.27)
- `GEMINI_API_KEY` 주석처리 (GOOGLE_API_KEY와 중복 경고 해결)
- `GOOGLE_CLOUD_STORAGE_BUCKET=createtree-upload` 명시 추가

---

## 3. FCM 푸시 알림 아키텍처 (2026.03.26~27 신규 구축)

### 3.1 핵심 아키텍처

```text
[Client App]
  └─ usePushNotifications.ts (2-Phase Token Register)
       Phase 1: 비로그인 → 토큰 LocalStorage 보관
       Phase 2: 로그인 완료 → POST /api/push/register-token (서버 Upsert)
  └─ App.tsx (CapacitorGlobalListeners — 딥링크 이벤트)

[Server]
  └─ push.token.service.ts — 토큰 CRUD, Topic 구독, 좀비 토큰 삭제
  └─ push.service.ts — Error-Isolated 청크 발송 (Promise.allSettled)
  └─ push.template.ts — 사용자/관리자/시스템 알림 팩토리
  └─ push.automation.service.ts — Rule Engine 평가 발송
  └─ push.automation.controller.ts — 규칙 CRUD API
  └─ index.ts — 24h setInterval 좀비 토큰 GC
```

### 3.2 DB 테이블
- `user_devices` — FCM 디바이스 토큰 저장 (isActive 관리)
- `push_delivery_logs` — 발송 성공/실패 이력 추적 (trigger_type 포함)
- `notifications` — 사용자 알림함 데이터 (actionUrl 딥링크)
- `auto_push_rules` — 자동 푸시 규칙 (eventType, titleTemplate, bodyTemplate, priority)

### 3.3 토큰 생명주기
- **로그아웃**: `auth.ts` → 활성 토큰 `isActive=false`
- **회원탈퇴**: `profile.ts` → 모든 토큰 비활성화
- **좀비 토큰 GC**: 서버 매 24시간 만료/비활성 토큰 정리

### 3.4 자동 푸시 Rule Engine (2026.03.27)
- **이벤트 트리거**: `mission_approved`, `mission_rejected`, `status_changed`, `user_register`
- **관리자 UI**: `PushAutomation.tsx` — 규칙 추가/토글/변수 칩 버튼 ({{userName}}, {{missionTitle}})
- 하드코딩 푸시 로직 → Rule Engine `evaluateAndSend()` 호출로 완전 대체

---

## 4. 사용자 알림함 시스템 (2026.03.27)

### 4.1 API
| 엔드포인트 | 메서드 | 기능 |
|-----------|--------|------|
| `/api/notifications` | GET | 알림 목록 (페이징, unreadCount) |
| `/api/notifications/unread-count` | GET | 읽지 않은 개수 (하단 네비 뱃지용, 30초 갱신) |
| `/api/notifications/read/:id` | POST | 단건 읽음 처리 |
| `/api/notifications/read-all` | POST | 전체 읽음 처리 |

### 4.2 프론트엔드 UI
- `notifications.tsx`: useInfiniteQuery 무한스크롤 + vaul Drawer 바텀 모달 상세보기
- `BottomNavigation.tsx`: MY 탭 Red Dot 뱃지 (pulse 애니메이션)
- `profile.tsx`: 마이페이지 "나의 알림" 메뉴 (뱃지 99+ 처리)
- 알림 유형별 아이콘: 승인=초록, 반려=빨강, 공지=파랑, 선물=보라, 관리자푸시=파란 메가폰

---

## 5. 다중 보상 및 리워드 시스템 (2026.03.26 ~ 04.07)

### 5.1 다중 보상 스키마 (2026.03.26)
- `bigMissions.giftItems` (JSONB): `[{imageUrl, description}]` 배열
- 하위호환: giftItems 비어있으면 기존 `giftImageUrl`/`giftDescription` fallback
- 관리자: `+ 보상 추가` 리스트형 UI, 사용자: 그리드 맵핑 모달

### 5.2 리워드 선물 신청 프로세스 (2026.04.07)
- 사용자: 큰미션 100% 달성 시 선물 신청 버튼 활성화 → 상태별 UI (신청전/검수대기/지급완료)
- 관리자: `RewardApplicationManagement.tsx` — 거래처 필터, 미션명 필터, 선물 확인 모달, 대기건수 배지
- 관리자↔사용자 양방향 이동: mymission-detail에서 관리자 바로가기 버튼, URL 파라미터 자동 필터

---

## 6. 프론트엔드 UI/UX 개편 상세 (2026.03.20 ~ 04.22)

### 6.1 하단 네비게이션 시스템 (2026.03.20)
- 중앙 FAB 돌출 버튼 (createTree 로고, 네온 글로우)
- Auto-Balancing 좌우 메뉴 (`flex-1 justify-around`)
- 글래스모피즘 배경 (`backdrop-blur 20px`, rgba 반사광)
- 나의미션 메뉴: superadmin 전용 제한 (`useMainMenus.ts` 필터)

### 6.2 미션 상세 페이지 개편
- **신청하기 버튼 하단 고정** (2026.03.25 → 04.21): 탭 슬롯에서 분리 → fixed bottom 고정
- **ApplicationStatusCard**: 상태별 7가지 분기 UI (미신청/검토중/승인/거절/대기/취소후/당일)
- **세부미션 조회/수정 모드 분리** (2026.03.27): 제출 완료 시 View 모드 → [수정] 버튼으로 전환
- **세부미션 탭 검수 중 배지**: 파란색 Send 아이콘 배지
- **신청승인 게이트 제거** (2026.03.26): 순차등급(sequentialLevel) 시스템으로 단일화
- **거래처명 표시 통일**: 리스트 카드 상단 배지 + 상세 페이지 제목 위 배지

### 6.3 나의미션(큰미션) 심플화 (2026.03.26)
- 상단 헤더 이미지 영역 제거 (사용자+관리자)
- 물방울/햇빛 슬롯 UI 제거
- 성장 캐릭터 이미지 2배 확대 (w-48→w-80)
- "미션 컬렉션" → "진행 미션 [N/M]" 타이틀 변경
- 하드코딩 "쑥쑥 자라는" 접두어 제거

### 6.4 성장 애니메이션 시스템 (2026.03.25)
- `bigMissions` 테이블: `growth_enabled`, `growth_tree_name`, `growth_stage_images` (JSONB)
- 관리자: 1~10단계 이미지 업로드 UI
- `CreationTreeProgress.tsx`: DB 이미지 우선 → 정적 파일 fallback

### 6.5 토스트 시스템 단일화 (2026.03.25)
- 3개 중복 구현체 → `hooks/use-toast.ts` 단일 파일로 통합
- 3초 자동닫힘 + duration 옵션 + TOAST_LIMIT=3

### 6.6 테마 반응형 스타일 통일 (2026.03.27)
- `ImageGenerationTemplate.tsx`: 하드코딩 색상 → 시맨틱 컬러 (`text-foreground`, `bg-card`)
- `snapshot.tsx`, `gallery-collage.tsx`: 메뉴 제목 스타일 통일
- 모바일 최적화: AI 스냅샷 3열/2열 그리드, 패딩 축소

### 6.7 SPA 스크롤 초기화 (2026.03.26)
- `App.tsx` Layout: `mainRef.current.scrollTop = 0` (location 변경 감지)
- 모든 페이지 자동 적용 (각 페이지 추가 코드 불필요)

---

## 7. 관리자 기능 강화

### 7.1 푸시 관제 대시보드
- 수동 푸시 발송 콘솔 (전체/병원별/개별)
- 발송 내역 로그 테이블 (페이지네이션)
- 자동화 설정 탭 (Rule Engine UI)
- 회원가입 시 자동 환영 푸시 (user_register 이벤트)

### 7.2 미션 관리 고도화
- 세부미션 활성 스위치 API 구현 (2026.03.20)
- 주제미션 폴더 이동 API 구현 + React.memo/useCallback 성능 최적화 (2026.03.24)
- 이미지 URL 직접입력 제거 → 파일 업로드 방식 통일 (2026.03.25)
- 토픽 아이콘 URL입력 → 파일 업로드 전환 (2026.03.25)
- 큰미션 헤더이미지 업로더 폐기 (2026.03.26)
- 메인 메뉴 description 필드 동적 관리 (2026.04.08)

### 7.3 액션 타입 관리 개편 (2026.04.21)
- "신청"만 시스템 보호, 나머지 수정/삭제 가능
- Lucide 50종 아이콘 한/영 검색 선택기
- DB `icon_url` → 미션 탭바 동적 반영 (하드코딩 fallback 유지)

---

## 8. 백엔드 버그 수정 및 안정화

### 8.1 AI 모델 안정화 (2026.03.20~21)
- 폐기 모델(`openai_mini`, `gptmini`) 자동 정화 로직 (`settings.ts`)
- AI 모델 타입 통일: `openai`, `gemini_3_1`, `gemini_3`
- 컨셉 POST/PUT API에 레거시 모델 자동 필터링
- `rejectReason` 컬럼 추가 (반려 사유 기록)

### 8.2 Firebase 업로드 경로 불일치 수정 (2026.03.20)
- `save-url` API: 두 가지 UID 형식 모두 허용 (`uploads/user_{id}/`, `uploads/{id}/`)
- `generate-stickers` API: `downloadedBuffers` → `imageBuffer` 할당 fallback 추가

### 8.3 갤러리 버그 수정
- 콜라주 전역 미노출 수정 (2026.03.31): SQL `NULL != 'value'` → `or(isNull(), ne())` 패턴
- 갤러리 원본 사진 노출 차단 (2026.03.21): `firebase_upload` 카테고리 필터
- 갤러리 카테고리 동적 필터링 (2026.03.24): 이미지 존재하는 카테고리만 버튼 노출

### 8.4 비밀번호 재설정 3중 버그 수정 (2026.04.17)
- 프로덕션 URL 하드코딩 → `req.protocol + req.headers.host` 동적 생성
- 토큰 만료 타임존 오차 → PostgreSQL `NOW() + interval` 로 대체
- Railway SMTP 차단 → Resend HTTP API 전환

### 8.5 큰미션 진행률 알고리즘 복구 (2026.03.26)
- 리팩토링 과정에서 소실된 `userBigMissionProgress` 업데이트 로직 복구
- 카테고리 Set 기반 안전한 재계산 알고리즘 (`recalculateUserBigMissionProgress`)

### 8.6 이미지 업로드 용량 상향 (2026.03.23)
- 상세페이지 이미지: 5MB → 10MB
- sharp 리사이징: 가로 1024px 기준, 세로 무제한 (`maxHeight: null` → `undefined`)

---

## 9. DB 스키마 변경 이력 (v3.3 이후)

| 날짜 | 테이블 | 변경 내용 |
|------|--------|----------|
| 03.25 | `bigMissions` | `growth_enabled`, `growth_tree_name`, `growth_stage_images` 추가 |
| 03.26 | `bigMissions` | `giftItems` (JSONB) 추가 |
| 03.26 | `sub_mission_submissions` | `reject_reason` 추가 |
| 03.26 | `user_devices` | FCM 디바이스 토큰 테이블 (신규) |
| 03.26 | `push_delivery_logs` | 푸시 발송 이력 테이블 (신규) |
| 03.27 | `auto_push_rules` | 자동 푸시 규칙 테이블 (신규) |
| 04.08 | `mainMenus` | `description` 텍스트 필드 추가 |

---

## 10. 의존성 패키지 변경 이력 (v3.3 이후 추가/변경)

| 패키지 | 버전 | 용도 | 추가 시점 |
|--------|------|------|----------|
| `resend` | ^6.12.0 | 이메일 발송 (Railway SMTP 차단 대응) | 2026.04.17 |
| `pg` | ^8.20.0 | Railway PostgreSQL 표준 TCP 드라이버 | 2026.03.22 |
| `@types/pg` | ^8.20.0 | pg 타입 정의 | 2026.03.22 |
| `vaul` | ^1.1.0 | 바텀 시트/Drawer 모달 | 기존 |
| `@dnd-kit/core` | ^6.3.1 | 미션 드래그앤드롭 정렬 | 기존 |
| `winston` | ^3.18.3 | 서버 로깅 | 기존 |
| `@capacitor/assets` | ^3.0.5 | 앱 아이콘/스플래시 자동 생성 (devDep) | 2026.03.20 |

### 레거시 패키지 (제거 권장)
| 패키지 | 이유 |
|--------|------|
| `@neondatabase/serverless` | Railway 이관 후 미사용 (코드 참조 없음) |
| `@sendgrid/mail` | Resend 전환 후 미사용 |

---

## 11. 안드로이드 앱 배포 현황

| 항목 | 상태 |
|------|------|
| 앱 이름 | AI문화센터 |
| 패키지명 | createtree |
| 최신 빌드 | versionCode 5+, versionName 1.4+ |
| 스토어 트랙 | 비공개 테스트 (프로덕션 승인 대기) |
| JDK | Red Hat OpenJDK 17 + Gradle 9.x |
| 아이콘/스플래시 | 74개 해상도별 자동 생성 (1024x1024 원본) |

---

## 12. 개발 환경 특이사항

### 12.1 개발 전용 자동 로그인 (2026.03.21)
- `GET /api/dev/auto-login` → superadmin 계정 자동 로그인 (JWT+세션+쿠키)
- `GET /api/dev/auth-status` → 인증 상태 확인
- `NODE_ENV !== 'production'` 가드

### 12.2 DB 접근 규칙
- 파일 기반 스크립트 (`npx tsx scripts/파일.ts`) 권장
- `npx tsx -e "..."` 인라인 금지 (CJS top-level await 미지원)
- 스크립트 템플릿: 표준 `pg` Pool + `main()` 패턴

---

## 13. 결론 및 향후 로드맵

v3.5는 **FCM 네이티브 푸시 + 자동화 Rule Engine + 다중 보상 + 리워드 신청 프로세스 + 이메일 엔진 교체**를 통해 플랫폼의 사용자 인게이지먼트와 운영 효율성을 프로덕션 수준으로 끌어올린 메이저 업데이트입니다.

**향후 계획:**
- 안드로이드 플레이스토어 프로덕션 정식 승인 및 iOS 앱 파이프라인 검증
- AI 이미지 편집기 고도화
- 대량 발송 시 Bulk Insert 최적화
- `@neondatabase/serverless`, `@sendgrid/mail` 등 레거시 패키지 정리

---

**문서 작성자:** Antigravity AI Agent  
**최종 검토/업데이트 일시:** 2026년 4월 22일 (v3.5 — 59건 인수인계 문서 전수 반영)
