# 종합 시스템 아키텍처 및 로직 명세서

## 1. 시스템 개요

### 1.1 프로젝트 핵심 목적

이 애플리케이션은 **AI 우리병원 문화센터 플랫폼**으로, 병원 문화센터를 위한 AI 기반 콘텐츠 생성 및 관리 플랫폼이다. 주요 기능은:

- **AI 음악 생성**: TopMediai 및 Suno API를 통한 맞춤형 음악 생성 (태교음악, 자장가 등)
- **AI 이미지 생성**: OpenAI DALL-E 3와 Google Gemini 2.5 Flash를 통한 이미지 변환 및 생성
- **콜라주 생성**: 여러 이미지를 조합한 콜라주 제작
- **병원 회원 관리**: QR 코드 기반 병원별 회원 등록 및 관리
- **마일스톤 시스템**: 임신 기간별 마일스톤 추적 및 참여형 캠페인
- **채팅 시스템**: 페르소나 기반 AI 채팅 상담
- **PWA 지원**: Progressive Web App으로 모바일 최적화

### 1.2 기술 스택 (Tech Stack)

| 카테고리 | 기술 | 버전 | 용도 |
|---------|------|------|------|
| **런타임** | Node.js | 20.x | 서버 런타임 |
| **언어** | TypeScript | 5.6.3 | 전체 프로젝트 타입 안전성 |
| **백엔드 프레임워크** | Express.js | 4.21.2 | REST API 서버 |
| **프론트엔드 프레임워크** | React | 18.3.1 | SPA UI 프레임워크 |
| **라우팅** | Wouter | 3.3.5 | 클라이언트 라우팅 |
| **UI 컴포넌트** | Radix UI | Latest | 접근성 기반 UI 컴포넌트 |
| **스타일링** | Tailwind CSS | 3.4.14 | 유틸리티 기반 CSS |
| **데이터베이스** | PostgreSQL (Neon) | - | 관계형 데이터베이스 |
| **ORM** | Drizzle ORM | 0.38.4 | 타입 안전 SQL 쿼리 |
| **인증** | JWT + Firebase Auth | - | 이중 인증 시스템 |
| **세션 관리** | express-session | 1.18.1 | 서버 세션 관리 |
| **파일 저장** | Google Cloud Storage | 7.16.0 | 클라우드 파일 저장소 |
| **AI 서비스** | OpenAI API | 4.104.0 | GPT-4o, DALL-E 3 |
| **AI 서비스** | Google Generative AI | 0.24.1 | Gemini 2.5 Flash |
| **음악 생성** | TopMediai API | Custom | AI 음악 생성 |
| **음악 생성** | Suno API | Custom | 폴백 음악 생성 |
| **상태 관리** | Zustand | 5.0.3 | 클라이언트 상태 관리 |
| **데이터 페칭** | TanStack Query | 5.60.5 | 서버 상태 관리 |
| **폼 관리** | React Hook Form | 7.53.1 | 폼 유효성 검사 |
| **빌드 도구** | Vite | 5.4.9 | 개발 서버 및 번들링 |
| **PWA** | vite-plugin-pwa | 1.0.0 | Progressive Web App |
| **이미지 처리** | Sharp | 0.34.2 | 썸네일 생성 |
| **보안** | bcrypt | 5.1.1 | 비밀번호 해싱 |
| **보안** | helmet | 8.1.0 | HTTP 보안 헤더 |
| **QR 코드** | qrcode | 1.5.4 | QR 코드 생성 |
| **이메일** | nodemailer | 7.0.4 | 이메일 발송 |

### 1.3 프로젝트 파일 구조

```
프로젝트 루트/
├── client/                   # 프론트엔드 React 애플리케이션
│   ├── public/              # 정적 파일
│   │   ├── icons/           # PWA 아이콘
│   │   └── manifest.json    # PWA 매니페스트
│   └── src/
│       ├── components/      # React 컴포넌트
│       │   ├── admin/       # 관리자 컴포넌트
│       │   ├── CollageBuilder/  # 콜라주 빌더
│       │   ├── gallery/     # 갤러리 컴포넌트
│       │   ├── hospital/    # 병원 관련 컴포넌트
│       │   ├── MilestoneApplication/  # 마일스톤 신청
│       │   ├── MusicGenerator/  # 음악 생성 UI
│       │   └── ui/          # shadcn/ui 컴포넌트
│       ├── pages/           # 라우트 페이지
│       │   ├── admin/       # 관리자 페이지
│       │   ├── dream-book/  # 드림북 페이지
│       │   ├── hospital/    # 병원 페이지
│       │   └── signup/      # 회원가입 페이지
│       ├── hooks/           # React 커스텀 훅
│       ├── lib/             # 유틸리티 라이브러리
│       ├── stores/          # Zustand 상태 관리
│       ├── styles/          # 글로벌 스타일
│       └── App.tsx          # 메인 앱 컴포넌트
├── server/                  # 백엔드 Express 서버
│   ├── middleware/          # Express 미들웨어
│   │   ├── auth.ts          # JWT 인증
│   │   ├── admin-auth.ts    # 관리자 권한
│   │   ├── permission.ts    # 권한 관리
│   │   ├── rate-limiter.ts  # API 속도 제한
│   │   └── security.ts      # 보안 미들웨어
│   ├── routes/              # API 라우트
│   │   ├── admin-routes.ts  # 관리자 API
│   │   ├── auth.ts          # 인증 API
│   │   ├── collage.ts       # 콜라주 API
│   │   ├── google-oauth.ts  # Google OAuth
│   │   ├── hospital-routes.ts # 병원 관리 API
│   │   ├── image.ts         # 이미지 생성 API
│   │   ├── music-engine-routes.ts # 음악 생성 API
│   │   └── upload.js        # GCS 업로드 API
│   ├── services/            # 비즈니스 로직 서비스
│   │   ├── auth.ts          # 인증 서비스
│   │   ├── collageServiceV2.ts # 콜라주 생성
│   │   ├── email.ts         # 이메일 발송
│   │   ├── firebase-auth.ts # Firebase 인증
│   │   ├── gemini.ts        # Google Gemini API
│   │   ├── milestones.ts    # 마일스톤 관리
│   │   ├── openai-dalle3.ts # DALL-E 3 이미지
│   │   ├── topmedia-service.ts # TopMediai 음악
│   │   └── notifications.ts # 알림 서비스
│   ├── utils/               # 유틸리티 함수
│   │   ├── gcs-image-storage.ts # GCS 이미지 저장
│   │   └── thumbnail.ts     # 썸네일 생성
│   ├── index.ts             # 서버 진입점
│   ├── routes.ts            # 라우트 등록
│   ├── storage.ts           # 데이터베이스 쿼리
│   └── vite.ts              # Vite 개발 서버
├── shared/                  # 공유 코드
│   ├── schema.ts            # Drizzle ORM 스키마
│   ├── constants.ts         # 공통 상수
│   └── qr-config.ts         # QR 설정
├── db/                      # 데이터베이스
│   ├── index.ts             # DB 연결
│   └── seed.ts              # 시드 데이터
├── static/                  # 정적 파일
│   ├── banner/              # 배너 이미지
│   ├── collages/            # 콜라주 이미지
│   └── milestones/          # 마일스톤 이미지
├── uploads/                 # 임시 업로드 파일
├── attached_assets/         # 첨부 파일
├── package.json             # 의존성 관리
├── tsconfig.json            # TypeScript 설정
├── vite.config.ts           # Vite 설정
├── tailwind.config.ts       # Tailwind 설정
├── drizzle.config.ts        # Drizzle 설정
├── replit.md               # 프로젝트 문서
└── .env                    # 환경 변수

```

## 2. 백엔드 아키텍처

### 2.1 API 엔드포인트 전체 명세

#### 2.1.1 인증 관련 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| GET | /api/auth/check-username/:username | auth.ts | false | 사용자명 중복 체크 | N/A | { "available": boolean, "message": string } |
| POST | /api/auth/register | auth.ts | false | 신규 사용자 회원가입 | { "username", "password", "email", "fullName", "phoneNumber", "birthdate", "hospitalId", "promoCode" } | { "user": {...}, "accessToken", "message" } |
| POST | /api/auth/login | auth.ts | false | 사용자 로그인 | { "username", "password" } | { "accessToken", "user": {...} } |
| POST | /api/auth/logout | auth.ts | true | 로그아웃 | N/A | { "message": "로그아웃되었습니다" } |
| GET | /api/auth/me | auth.ts | true | 현재 로그인 사용자 정보 | N/A | { "success": true, "user": {...} } |
| PUT | /api/auth/profile | auth.ts | true | 프로필 업데이트 | { "fullName", "email", "phoneNumber", "dueDate", "birthdate" } | { "success": true, "user": {...} } |
| POST | /api/auth/firebase | auth.ts | false | Firebase 소셜 로그인 | { "firebaseToken" } | { "user": {...}, "token", "isNewUser" } |
| POST | /api/auth/forgot-password | auth.ts | false | 비밀번호 재설정 요청 | { "identifier" } | { "success": true, "message" } |
| POST | /api/auth/reset-password | auth.ts | false | 비밀번호 재설정 | { "token", "newPassword" } | { "success": true, "message" } |
| POST | /api/auth/google | google-oauth.ts | false | Google OAuth 로그인 | { "idToken" } | { "user": {...}, "token", "isNewUser" } |

#### 2.1.2 음악 생성 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| POST | /api/music/generate | music-engine-routes.ts | true | AI 음악 생성 요청 | { "prompt", "style", "duration", "gender", "instrumental" } | { "success": true, "musicId", "message" } |
| GET | /api/music/status/:id | music-engine-routes.ts | true | 음악 생성 상태 확인 | N/A | { "success": true, "status", "url", "progress" } |
| GET | /api/music/styles | music-engine-routes.ts | false | 음악 스타일 목록 | N/A | [{ "id", "value", "label", "description" }] |
| GET | /api/music/stream/:id | server/index.ts | false | 음악 스트리밍 | N/A | Audio stream |
| DELETE | /api/music/:id | music-engine-routes.ts | true | 음악 삭제 | N/A | { "success": true } |

#### 2.1.3 이미지 생성 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| POST | /api/images/transform | image.ts | true | AI 이미지 변환 | { "imageUrl", "conceptId", "style", "model" } | { "success": true, "transformedUrl", "thumbnailUrl" } |
| POST | /api/images/generate | image.ts | true | AI 이미지 생성 | { "prompt" } | { "success": true, "imageUrl" } |
| GET | /api/gallery | image.ts | true | 이미지 갤러리 조회 | N/A | { "images": [...], "total", "page" } |
| DELETE | /api/images/:id | image.ts | true | 이미지 삭제 | N/A | { "success": true } |

#### 2.1.4 콜라주 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| POST | /api/collage/generate | collage.ts | true | 콜라주 생성 | { "images", "layout", "title", "backgroundColor" } | { "success": true, "collageUrl" } |
| POST | /api/collage/download | collage.ts | true | 콜라주 다운로드 | { "dataUrl", "title", "style" } | { "success": true, "url", "id" } |
| GET | /api/collage/gallery | collage.ts | true | 콜라주 갤러리 | N/A | { "collages": [...] } |

#### 2.1.5 관리자 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| GET | /api/admin/users | admin-routes.ts | admin | 사용자 목록 조회 | N/A | { "users": [...], "total" } |
| PUT | /api/admin/users/:id | admin-routes.ts | admin | 사용자 정보 수정 | { "memberType", "hospitalId", ... } | { "success": true, "user": {...} } |
| DELETE | /api/admin/users/:id | admin-routes.ts | admin | 사용자 삭제 | N/A | { "success": true } |
| GET | /api/admin/hospitals | admin-routes.ts | admin | 병원 목록 조회 | N/A | { "hospitals": [...] } |
| POST | /api/admin/hospitals | admin-routes.ts | admin | 병원 등록 | { "name", "slug", "address", "phone" } | { "success": true, "hospital": {...} } |
| PUT | /api/admin/hospitals/:id | admin-routes.ts | admin | 병원 정보 수정 | { "name", "isActive", ... } | { "success": true, "hospital": {...} } |
| GET | /api/admin/concepts | admin-routes.ts | admin | 컨셉 목록 조회 | N/A | { "concepts": [...] } |
| POST | /api/admin/concepts | admin-routes.ts | admin | 컨셉 생성 | { "conceptId", "title", "promptTemplate", ... } | { "success": true, "concept": {...} } |
| PUT | /api/admin/concepts/:id | admin-routes.ts | admin | 컨셉 수정 | { "title", "isActive", ... } | { "success": true, "concept": {...} } |

#### 2.1.6 병원 관리 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| GET | /api/hospital/members | hospital-routes.ts | hospital_admin | 병원 회원 목록 | N/A | { "members": [...], "total" } |
| GET | /api/hospital/dashboard | hospital-routes.ts | hospital_admin | 병원 대시보드 | N/A | { "stats": {...}, "recentMembers": [...] } |
| POST | /api/hospital/codes | hospital-routes.ts | hospital_admin | 병원 코드 생성 | { "codeType", "maxUsage", "description" } | { "success": true, "code": {...} } |
| GET | /api/hospital/codes | hospital-routes.ts | hospital_admin | 병원 코드 목록 | N/A | { "codes": [...] } |
| DELETE | /api/hospital/codes/:id | hospital-routes.ts | hospital_admin | 병원 코드 삭제 | N/A | { "success": true } |
| GET | /api/hospital/qr/:code | hospital-routes.ts | false | QR 코드 정보 조회 | N/A | { "hospital": {...}, "code": {...} } |

#### 2.1.7 마일스톤 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| GET | /api/milestones | public-routes.ts | false | 마일스톤 목록 | N/A | { "milestones": [...] } |
| POST | /api/milestones/:id/apply | public-routes.ts | true | 마일스톤 신청 | { "applicationData" } | { "success": true, "application": {...} } |
| GET | /api/milestone-applications | public-routes.ts | true | 내 신청 목록 | N/A | { "applications": [...] } |
| POST | /api/milestone-applications/:id/files | server/routes.ts | true | 파일 업로드 | FormData | { "success": true, "file": {...} } |
| GET | /api/milestone-applications/:id/files | server/routes.ts | true | 파일 목록 | N/A | { "files": [...], "stats": {...} } |

#### 2.1.8 기타 API

| HTTP Method | URL Path | 담당 파일 | 인증 필요 여부 | 간단한 설명 | Request Body (JSON 형식) | Success Response (JSON 형식) |
|------------|----------|----------|---------------|------------|--------------------------|------------------------------|
| GET | /api/banners | public-routes.ts | false | 슬라이드 배너 목록 | N/A | [{ "id", "title", "imageUrl", ... }] |
| GET | /api/small-banners | public-routes.ts | false | 소형 배너 목록 | N/A | [{ "id", "title", "imageUrl", ... }] |
| GET | /api/menu | public-routes.ts | false | 메뉴 항목 목록 | N/A | [{ "id", "title", "icon", "items": [...] }] |
| POST | /api/chat | server/routes.ts | true | AI 채팅 | { "message", "personaSystemPrompt" } | { "response": "..." } |
| GET | /api/personas | server/routes.ts | false | 페르소나 목록 | N/A | { "personas": [...], "categories": [...] } |
| POST | /api/gcs-test | server/routes.ts | false | GCS 업로드 테스트 | FormData | { "success": true, "url", "gsPath" } |

### 2.2 데이터베이스 스키마

#### 2.2.1 users 테이블

| Column | Data Type | Constraints | 설명 |
|--------|-----------|------------|------|
| id | SERIAL | PRIMARY KEY | 사용자 고유 ID |
| username | TEXT | UNIQUE, NOT NULL | 사용자 로그인 아이디 |
| password | TEXT | | 해싱된 비밀번호 (소셜 로그인은 NULL 가능) |
| email | VARCHAR(255) | UNIQUE | 사용자 이메일 |
| fullName | VARCHAR(100) | | 전체 이름 |
| emailVerified | BOOLEAN | DEFAULT false | 이메일 인증 여부 |
| memberType | VARCHAR(20) | DEFAULT 'free' | 회원 등급 (free, pro, membership, hospital_admin, admin, superadmin) |
| hospitalId | INTEGER | FOREIGN KEY | 소속 병원 ID |
| promoCode | VARCHAR(50) | | 프로모션 코드 |
| lastLogin | TIMESTAMP | | 마지막 로그인 시간 |
| phoneNumber | VARCHAR(20) | | 전화번호 |
| dueDate | TIMESTAMP | | 출산 예정일 |
| birthdate | TIMESTAMP | | 생년월일 |
| firebaseUid | VARCHAR(128) | UNIQUE | Firebase 고유 ID |
| needProfileComplete | BOOLEAN | DEFAULT true | 프로필 완성 필요 여부 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 생성 시간 |
| updatedAt | TIMESTAMP | DEFAULT NOW() | 수정 시간 |

#### 2.2.2 hospitals 테이블

| Column | Data Type | Constraints | 설명 |
|--------|-----------|------------|------|
| id | SERIAL | PRIMARY KEY | 병원 고유 ID |
| name | TEXT | NOT NULL | 병원 이름 |
| slug | TEXT | UNIQUE, NOT NULL | 병원 URL 슬러그 |
| address | TEXT | | 병원 주소 |
| phone | TEXT | | 병원 전화번호 |
| email | TEXT | | 병원 이메일 |
| domain | TEXT | | 커스텀 도메인 |
| logoUrl | TEXT | | 병원 로고 URL |
| themeColor | TEXT | | 테마 색상 |
| contractStartDate | TIMESTAMP | | 계약 시작일 |
| contractEndDate | TIMESTAMP | | 계약 종료일 |
| packageType | TEXT | DEFAULT 'basic' | 패키지 타입 (basic, premium, enterprise) |
| isActive | BOOLEAN | DEFAULT true | 활성화 상태 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 생성 시간 |
| updatedAt | TIMESTAMP | DEFAULT NOW() | 수정 시간 |

#### 2.2.3 music 테이블

| Column | Data Type | Constraints | 설명 |
|--------|-----------|------------|------|
| id | SERIAL | PRIMARY KEY | 음악 고유 ID |
| title | TEXT | NOT NULL | 음악 제목 |
| prompt | TEXT | NOT NULL | 사용자 프롬프트 |
| style | TEXT | | 음악 스타일 |
| translatedPrompt | TEXT | | 영어 번역 프롬프트 |
| tags | JSONB | DEFAULT '[]' | 스타일 태그 |
| url | TEXT | | 최종 오디오 파일 URL |
| lyrics | TEXT | | 생성된 가사 |
| instrumental | BOOLEAN | DEFAULT false | 반주 전용 여부 |
| duration | INTEGER | DEFAULT 60 | 음악 길이(초) |
| userId | INTEGER | | 사용자 ID |
| provider | TEXT | DEFAULT 'topmedia' | 음악 생성 제공자 |
| creditUsed | INTEGER | DEFAULT 1 | 사용된 크레딧 |
| engine | VARCHAR(20) | DEFAULT 'topmedia' | 사용된 엔진 (topmedia, suno) |
| engineTaskId | VARCHAR(100) | | 엔진별 작업 ID |
| fallbackUsed | BOOLEAN | DEFAULT false | 폴백 엔진 사용 여부 |
| gcsPath | VARCHAR(500) | | GCS 저장 경로 |
| contentType | VARCHAR(50) | DEFAULT 'audio/mpeg' | MIME 타입 |
| durationSec | INTEGER | | 실제 음악 길이(초) |
| status | TEXT | DEFAULT 'pending' | 생성 상태 (pending, processing, done, error) |
| songId | TEXT | | TopMediai song_id |
| generateLyrics | BOOLEAN | DEFAULT false | 가사 자동 생성 여부 |
| gender | TEXT | | 가수 성별 (female, male, child, auto) |
| hospitalId | INTEGER | FOREIGN KEY | 병원 ID |
| metadata | JSONB | DEFAULT '{}' | 추가 메타데이터 |
| isFavorite | BOOLEAN | DEFAULT false | 즐겨찾기 여부 |
| isPublic | BOOLEAN | DEFAULT false | 공개 여부 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 생성 시간 |
| updatedAt | TIMESTAMP | DEFAULT NOW() | 수정 시간 |

#### 2.2.4 images 테이블

| Column | Data Type | Constraints | 설명 |
|--------|-----------|------------|------|
| id | SERIAL | PRIMARY KEY | 이미지 고유 ID |
| title | TEXT | NOT NULL | 이미지 제목 |
| style | TEXT | NOT NULL | 이미지 스타일 |
| originalUrl | TEXT | NOT NULL | 원본 이미지 URL |
| transformedUrl | TEXT | NOT NULL | 변환된 이미지 URL |
| thumbnailUrl | TEXT | | 썸네일 URL |
| metadata | TEXT | DEFAULT '{}' | 메타데이터 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 생성 시간 |
| userId | VARCHAR(128) | | 사용자 ID (이메일 또는 Firebase UID) |
| categoryId | VARCHAR(50) | | 카테고리 ID |
| conceptId | VARCHAR(50) | | 컨셉 ID |
| styleId | VARCHAR(50) | | 스타일 ID |

#### 2.2.5 milestones 테이블

| Column | Data Type | Constraints | 설명 |
|--------|-----------|------------|------|
| id | SERIAL | PRIMARY KEY | 마일스톤 고유 ID |
| milestoneId | TEXT | UNIQUE, NOT NULL | 마일스톤 식별자 |
| title | TEXT | NOT NULL | 마일스톤 제목 |
| description | TEXT | NOT NULL | 마일스톤 설명 |
| weekStart | INTEGER | NOT NULL | 시작 주차 |
| weekEnd | INTEGER | NOT NULL | 종료 주차 |
| badgeEmoji | TEXT | NOT NULL | 배지 이모지 |
| badgeImageUrl | TEXT | | 배지 이미지 URL |
| encouragementMessage | TEXT | NOT NULL | 격려 메시지 |
| categoryId | TEXT | FOREIGN KEY | 카테고리 ID |
| order | INTEGER | DEFAULT 0 | 정렬 순서 |
| isActive | BOOLEAN | DEFAULT true | 활성화 여부 |
| type | VARCHAR(20) | DEFAULT 'info' | 타입 (info, campaign) |
| hospitalId | INTEGER | FOREIGN KEY | 병원 ID |
| headerImageUrl | TEXT | | 헤더 이미지 URL |
| campaignStartDate | TIMESTAMP | | 캠페인 시작일 |
| campaignEndDate | TIMESTAMP | | 캠페인 종료일 |
| selectionStartDate | TIMESTAMP | | 선정 시작일 |
| selectionEndDate | TIMESTAMP | | 선정 종료일 |
| maxParticipants | INTEGER | | 최대 참여 인원 |
| currentParticipants | INTEGER | DEFAULT 0 | 현재 참여 인원 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 생성 시간 |
| updatedAt | TIMESTAMP | DEFAULT NOW() | 수정 시간 |

#### 2.2.6 hospitalCodes 테이블

| Column | Data Type | Constraints | 설명 |
|--------|-----------|------------|------|
| id | SERIAL | PRIMARY KEY | 코드 고유 ID |
| hospitalId | INTEGER | FOREIGN KEY, NOT NULL | 병원 ID |
| code | VARCHAR(20) | UNIQUE, NOT NULL | 인증 코드 |
| codeType | VARCHAR(20) | NOT NULL | 코드 타입 (master, limited, qr_unlimited, qr_limited) |
| maxUsage | INTEGER | | 최대 사용 횟수 (NULL = 무제한) |
| currentUsage | INTEGER | DEFAULT 0 | 현재 사용 횟수 |
| isQREnabled | BOOLEAN | DEFAULT false | QR 코드 활성화 |
| qrDescription | VARCHAR(100) | | QR 코드 설명 |
| isActive | BOOLEAN | DEFAULT true | 활성화 상태 |
| expiresAt | TIMESTAMP | | 만료 시간 |
| createdAt | TIMESTAMP | DEFAULT NOW() | 생성 시간 |
| updatedAt | TIMESTAMP | DEFAULT NOW() | 수정 시간 |

### 2.3 인증 및 권한 부여 로직

#### 2.3.1 JWT 페이로드 구조

```typescript
interface JWTPayload {
  id: number;           // 사용자 ID
  userId: number;       // 하위 호환성을 위한 중복 필드
  email: string | null;
  memberType: string | null;  // free, pro, membership, hospital_admin, admin, superadmin
  hospitalId?: number | null;
  username?: string;
  iat?: number;         // 토큰 발급 시간
  exp?: number;         // 토큰 만료 시간
}
```

#### 2.3.2 인증 미들웨어 처리 순서

1. **토큰 추출**: 
   - 쿠키에서 `auth_token` 확인
   - 없으면 Authorization 헤더에서 `Bearer` 토큰 확인

2. **토큰 검증**: 
   - `jwt.verify(token, JWT_SECRET)` 실행
   - 만료 여부 확인
   - 서명 유효성 확인

3. **사용자 정보 주입**:
   - 검증 성공 시 `req.user`에 디코딩된 사용자 정보 할당
   - 다음 미들웨어로 전달

4. **권한 검증**:
   - `requireAdminOrSuperAdmin`: memberType이 'admin' 또는 'superadmin' 확인
   - `requireHospitalAdmin`: memberType이 'hospital_admin' 및 hospitalId 존재 확인
   - `requireActiveHospital`: 병원 활성화 상태 추가 확인

#### 2.3.3 Firebase 인증 통합

```typescript
// Firebase 인증 처리 흐름
1. 클라이언트에서 Firebase 소셜 로그인
2. Firebase ID Token을 서버로 전송
3. 서버에서 Firebase Admin SDK로 토큰 검증
4. 사용자 정보 추출 (UID, email, name)
5. 기존 사용자 확인 또는 신규 생성
6. JWT 토큰 발급 및 쿠키 설정
```

## 3. 프론트엔드 아키텍처

### 3.1 컴포넌트 구조

#### 3.1.1 주요 페이지 컴포넌트

- **home.tsx**: 메인 홈페이지 (배너, 메뉴 카드)
- **auth.tsx**: 로그인/회원가입 페이지
- **gallery-simplified.tsx**: 이미지 갤러리
- **gallery-collage.tsx**: 콜라주 갤러리
- **lullaby.tsx**: 자장가 생성 페이지
- **maternity-photo.tsx**: 만삭 사진 생성
- **family-photo.tsx**: 가족 사진 생성
- **stickers.tsx**: 스티커 생성
- **chat.tsx**: AI 채팅 페이지
- **milestones.tsx**: 마일스톤 페이지
- **admin.tsx**: 관리자 대시보드
- **hospital-campaigns.tsx**: 병원 캠페인 관리

#### 3.1.2 주요 컴포넌트 모듈

```
components/
├── admin/
│   ├── CategoryManagement.tsx    # 카테고리 관리
│   ├── ConceptManagement.tsx      # 컨셉 관리
│   ├── HospitalManagement.tsx     # 병원 관리
│   └── UserManagement.tsx         # 사용자 관리
├── CollageBuilder/
│   ├── CollageBuilder.tsx         # 콜라주 빌더 메인
│   ├── CollageCanvas.tsx          # 캔버스 렌더링
│   └── CollagePreview.tsx         # 미리보기 및 저장
├── gallery/
│   ├── GalleryGrid.tsx            # 갤러리 그리드
│   ├── GalleryItem.tsx            # 개별 아이템
│   └── GalleryModal.tsx           # 확대 모달
├── MusicGenerator/
│   ├── MusicForm.tsx              # 음악 생성 폼
│   ├── MusicPlayer.tsx            # 오디오 플레이어
│   └── MusicStatus.tsx            # 생성 상태 표시
└── ui/                            # shadcn/ui 컴포넌트
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── form.tsx
    └── toast.tsx
```

### 3.2 상태 관리 (State Management)

#### 3.2.1 Zustand Store 구조

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

// stores/musicStore.ts
interface MusicState {
  currentMusic: Music | null;
  isPlaying: boolean;
  playlist: Music[];
  setCurrentMusic: (music: Music) => void;
  togglePlay: () => void;
}

// stores/galleryStore.ts
interface GalleryState {
  images: Image[];
  selectedImage: Image | null;
  filter: string;
  setImages: (images: Image[]) => void;
  setFilter: (filter: string) => void;
}
```

#### 3.2.2 TanStack Query 사용 패턴

```typescript
// 데이터 페칭 예시
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/gallery', page],
  queryFn: async () => {
    const response = await fetch(`/api/gallery?page=${page}`);
    return response.json();
  },
  staleTime: 5 * 60 * 1000, // 5분
});

// 뮤테이션 예시
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await apiRequest('/api/images/transform', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
    toast.success('이미지가 생성되었습니다');
  },
});
```

### 3.3 API 연동

#### 3.3.1 API 클라이언트 설정

```typescript
// lib/queryClient.ts
export const apiRequest = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // 쿠키 포함
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response;
};
```

#### 3.3.2 인증 상태 관리

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  const login = useMutation({
    mutationFn: async (credentials) => {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/auth/me'], data.user);
    },
  });

  return { user, isLoading, login };
};
```

## 4. 외부 통합

### 4.1 AI API (Gemini)

#### 4.1.1 Gemini 설정

```typescript
// server/services/gemini.ts
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-exp" 
});
```

#### 4.1.2 Gemini 요청 구조

```typescript
const request = {
  contents: [{
    role: "user",
    parts: [{
      text: prompt
    }]
  }],
  generationConfig: {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
  }
};
```

### 4.2 OpenAI API

#### 4.2.1 DALL-E 3 이미지 생성

```typescript
// server/services/openai-dalle3.ts
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const imageResponse = await openai.images.generate({
  model: "dall-e-3",
  prompt: enhancedPrompt,
  n: 1,
  size: "1024x1024",
  quality: "hd",
  style: "vivid"
});
```

#### 4.2.2 GPT-4o 프롬프트 강화

```typescript
const chatResponse = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  temperature: 0.8,
  max_tokens: 500
});
```

### 4.3 TopMediai 음악 생성

#### 4.3.1 3단계 워크플로우

```typescript
// 1단계: 가사 생성
POST https://api.topmediai.com/v1/music/generate-lyrics
{
  "prompt": userPrompt,
  "expand": false
}

// 2단계: 음악 생성
POST https://api.topmediai.com/v1/music
{
  "lyrics": generatedLyrics,
  "style": selectedStyle,
  "title": musicTitle
}

// 3단계: 다운로드 URL 확인
GET https://api.topmediai.com/v1/music/download/${song_id}
```

### 4.4 Google Cloud Storage

#### 4.4.1 버킷 구조

```
createtree-upload/
├── users/
│   ├── {userId}/
│   │   ├── images/
│   │   ├── music/
│   │   └── collages/
├── static/
│   ├── banners/
│   └── milestones/
└── temp/
```

#### 4.4.2 업로드 패턴

```typescript
// server/utils/gcs-image-storage.ts
export async function saveImageToGCS(
  imageBuffer: Buffer,
  userId: string,
  metadata: ImageMetadata
): Promise<{ url: string; thumbnailUrl: string }> {
  const fileName = `${userId}/images/${Date.now()}_${metadata.title}.png`;
  const file = bucket.file(fileName);
  
  await file.save(imageBuffer, {
    metadata: {
      contentType: 'image/png',
      metadata: {
        userId,
        ...metadata
      }
    }
  });
  
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  
  // 썸네일 생성
  const thumbnailUrl = await generateThumbnail(imageBuffer, fileName);
  
  return { url, thumbnailUrl };
}
```

## 5. 배포 및 환경 설정

### 5.1 필수 환경 변수

| 변수명 | 설명 | 예시 값 (플레이스홀더) |
|--------|------|----------------------|
| JWT_SECRET | JWT 토큰 서명에 사용되는 비밀 키 | [YOUR_JWT_SECRET] |
| DATABASE_URL | PostgreSQL 데이터베이스 연결 주소 | [YOUR_POSTGRES_DB_URL] |
| NODE_ENV | 실행 환경 | development / production |
| VITE_FIREBASE_API_KEY | Firebase 웹 API 키 | [YOUR_FIREBASE_API_KEY] |
| VITE_FIREBASE_PROJECT_ID | Firebase 프로젝트 ID | [YOUR_FIREBASE_PROJECT_ID] |
| VITE_FIREBASE_APP_ID | Firebase 앱 ID | [YOUR_FIREBASE_APP_ID] |
| VITE_FIREBASE_AUTH_DOMAIN | Firebase 인증 도메인 | [YOUR_FIREBASE_AUTH_DOMAIN] |
| VITE_GOOGLE_CLIENT_ID | Google OAuth 클라이언트 ID | [YOUR_GOOGLE_CLIENT_ID] |
| FB_TYPE | Firebase Admin 서비스 계정 타입 | service_account |
| FB_PROJECT_ID | Firebase Admin 프로젝트 ID | [YOUR_FB_PROJECT_ID] |
| FB_PRIVATE_KEY_ID | Firebase Admin 개인 키 ID | [YOUR_FB_PRIVATE_KEY_ID] |
| FB_PRIVATE_KEY | Firebase Admin 개인 키 | [YOUR_FB_PRIVATE_KEY] |
| FB_CLIENT_EMAIL | Firebase Admin 클라이언트 이메일 | [YOUR_FB_CLIENT_EMAIL] |
| FB_CLIENT_ID | Firebase Admin 클라이언트 ID | [YOUR_FB_CLIENT_ID] |
| GCS_BUCKET | Google Cloud Storage 버킷 이름 | createtree-upload |
| OPENAI_API_KEY | OpenAI API 키 | [YOUR_OPENAI_API_KEY] |
| GOOGLE_GEMINI_API_KEY | Google Gemini API 키 | [YOUR_GEMINI_API_KEY] |
| TOPMEDIA_ENABLED | TopMediai 엔진 활성화 | true |
| SUNO_ENABLED | Suno 엔진 활성화 | true |
| DEFAULT_ENGINE | 기본 음악 엔진 | topmedia |
| ENGINE_FALLBACK_ORDER | 엔진 폴백 순서 | topmedia,suno |
| SUNO_API_KEY | Suno API 키 | [YOUR_SUNO_API_KEY] |
| POLLO_API_KEY | Pollo AI API 키 | [YOUR_POLLO_API_KEY] |
| USE_POLLO_API | Pollo API 사용 여부 | true |
| GCS_MUSIC_PATH_TOPMEDIA | TopMediai 음악 GCS 경로 | music/topmedia |
| GCS_MUSIC_PATH_SUNO | Suno 음악 GCS 경로 | music/suno |
| SIGNED_URL_TTL_SEC | 서명된 URL 유효 시간(초) | 900 |
| USE_DUMMY_MUSIC | 더미 음악 사용 여부 | false |

### 5.2 빌드 및 실행 스크립트

```json
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push --force --config=./drizzle.config.ts",
    "db:seed": "tsx db/seed.ts"
  }
}
```

### 5.3 보안 설정

#### 5.3.1 HTTP 보안 헤더 (helmet)

```typescript
// server/middleware/security.ts
export const securityHeaders = () => helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    }
  },
  crossOriginEmbedderPolicy: false,
});
```

#### 5.3.2 CORS 설정

```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

#### 5.3.3 Rate Limiting

```typescript
// server/middleware/rate-limiter.ts
export const apiRateLimiter = new RateLimiterMemory({
  points: 100,      // 요청 수
  duration: 60,     // 초 단위 (1분)
  blockDuration: 60 // 차단 시간 (1분)
});
```

### 5.4 PWA 설정

#### 5.4.1 매니페스트 파일

```json
{
  "name": "AI 우리병원 문화센터",
  "short_name": "우리병원",
  "description": "AI 기반 병원 문화센터 플랫폼",
  "theme_color": "#7c3aed",
  "background_color": "#ffffff",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 5.4.2 Service Worker 설정

```typescript
// vite.config.ts - PWA 플러그인 설정
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'icons/*.png'],
  manifest: {
    // 매니페스트 설정
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/storage\.googleapis\.com/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gcs-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60 // 30일
          }
        }
      }
    ]
  }
})
```

## 6. 주요 비즈니스 로직

### 6.1 음악 생성 워크플로우

```
1. 사용자가 프롬프트, 스타일, 성별 선택
2. 프론트엔드에서 /api/music/generate POST 요청
3. 서버에서 TopMediai 3단계 처리:
   - 가사 생성 API 호출
   - 음악 생성 API 호출 (song_id 반환)
   - 폴링으로 다운로드 URL 확인
4. 완료 시 GCS에 저장
5. 데이터베이스에 메타데이터 저장
6. 프론트엔드로 음악 URL 반환
7. 오디오 플레이어에서 스트리밍 재생
```

### 6.2 이미지 변환 워크플로우

```
1. 사용자가 이미지 업로드 및 컨셉 선택
2. 모델 선택 (OpenAI DALL-E 3 또는 Gemini)
3. 서버에서 이미지 분석 및 프롬프트 생성:
   - GPT-4o로 이미지 분석
   - 컨셉 템플릿과 결합
4. 선택된 모델로 이미지 생성:
   - DALL-E 3: 고품질, 정확한 변환
   - Gemini: 빠른 처리, 비용 효율
5. GCS에 원본과 변환 이미지 저장
6. 썸네일 자동 생성
7. 데이터베이스에 저장
8. 갤러리에 즉시 표시
```

### 6.3 병원 회원 등록 플로우

```
1. 병원 관리자가 QR 코드 생성
2. QR 코드에 병원 코드 인코딩
3. 사용자가 QR 스캔 또는 코드 입력
4. 서버에서 코드 유효성 검증:
   - 병원 활성화 상태 확인
   - 코드 사용 횟수 확인
   - 만료 시간 확인
5. 회원가입 폼에 병원 정보 자동 입력
6. 회원가입 완료 시 병원과 연결
7. 병원별 전용 콘텐츠 접근 가능
```

### 6.4 마일스톤 참여 시스템

```
1. 사용자가 참여형 마일스톤 선택
2. 참여 기간 확인 (campaignStartDate ~ campaignEndDate)
3. 신청서 작성 및 파일 업로드
4. 관리자 심사 대기 (pending 상태)
5. 관리자 승인/거절 처리
6. 선정 기간에 최종 결과 발표
7. 승인된 사용자에게 알림 발송
8. 마일스톤 배지 획득
```

## 7. 시스템 특이사항

### 7.1 파일 저장 정책

- **필수 규칙**: 모든 생성 파일은 반드시 Google Cloud Storage에 저장
- 로컬 파일 시스템 사용 금지 (Replit 환경 특성상 휘발성)
- 단, `static/banner/`와 `static/milestones/`는 영구 저장용 예외

### 7.2 이중 엔진 시스템

- TopMediai가 주 엔진, 실패 시 Suno로 자동 폴백
- 엔진별 다른 GCS 경로 사용
- 폴백 사용 여부를 데이터베이스에 기록

### 7.3 권한 계층 구조

```
superadmin > admin > hospital_admin > membership > pro > free

- superadmin: 시스템 전체 관리
- admin: 일반 관리 기능
- hospital_admin: 소속 병원 관리
- membership: 병원 회원
- pro: 프리미엄 사용자
- free: 무료 사용자
```

### 7.4 캐싱 전략

- JWT 토큰: 메모리 캐싱으로 인증 속도 개선
- 이미지: CDN 캐싱 30일
- API 응답: TanStack Query로 5분 캐싱
- 정적 파일: Service Worker로 오프라인 지원

### 7.5 성능 최적화

- 이미지 자동 썸네일 생성 (200x200)
- 음악 스트리밍: Range 요청 지원
- HTTP/2 연결 재사용 (keep-alive)
- 동적 폴링 간격 (2초 → 5초 점진 증가)

## 8. 에러 처리 및 로깅

### 8.1 에러 코드 체계

- 400: 잘못된 요청 (유효성 검사 실패)
- 401: 인증 필요 (토큰 없음/만료)
- 403: 권한 없음 (등급 불충분)
- 404: 리소스 없음
- 409: 충돌 (중복 데이터)
- 429: 요청 제한 초과
- 500: 서버 내부 오류
- 502: 외부 서비스 오류

### 8.2 로깅 패턴

```typescript
console.log(`[${모듈명}] 작업 시작 - 상세 정보`);
console.error(`[${모듈명}] ❌ 오류 발생:`, error);
console.warn(`[${모듈명}] ⚠️ 경고:`, message);
```

### 8.3 에러 복구 전략

- API 재시도: 3회, 지수 백오프
- 폴백 이미지/음악 제공
- 사용자 친화적 오류 메시지
- 관리자 알림 (critical 오류)

---

**문서 버전**: 1.0.0
**최종 수정일**: 2025-09-04
**작성자**: Replit AI Agent (시니어 소프트웨어 아키텍트 역할)