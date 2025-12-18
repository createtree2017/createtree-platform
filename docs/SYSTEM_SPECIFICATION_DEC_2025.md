# 창조AI V2 - 종합 시스템 명세서
**버전:** 2.0  
**작성일:** 2025년 12월 18일  
**문서 상태:** Production Ready

---

## 1. 시스템 개요

### 1.1 프로젝트 소개
창조AI V2는 산후조리원 및 산부인과 병원을 위한 AI 기반 문화센터 플랫폼입니다. 임산부와 가족들에게 AI 음악 생성, AI 이미지 변환, AI 스냅샷 생성, 미션 시스템 등 다양한 창작 서비스를 제공합니다.

### 1.2 핵심 기능 요약
| 기능 | 설명 | 상태 |
|------|------|------|
| AI 음악 생성 | TopMediai API 기반 맞춤형 태교 음악 생성 | Production |
| AI 이미지 변환 | 이미지 스타일 변환 및 캐릭터 생성 | Production |
| AI 스냅샷 | 3개 AI 모델, 420개 프롬프트 기반 인물 사진 생성 | Production |
| 미션 시스템 | 스타벅스 프리퀀시 모델 기반 슬롯형 미션 | Production |
| AI 채팅 | 페르소나 기반 대화형 AI 상담 | Production |
| 갤러리 | 생성된 콘텐츠 통합 관리 및 다운로드 | Production |

### 1.3 기술 스택
```
Frontend:
├── React 18 + TypeScript
├── Vite 5 (빌드 도구)
├── TanStack Query v5 (서버 상태 관리)
├── Wouter (라우팅)
├── Tailwind CSS + shadcn/ui (UI 컴포넌트)
├── Lucide React (아이콘)
└── Framer Motion (애니메이션)

Backend:
├── Node.js + Express.js
├── TypeScript (ESM 모듈)
├── Drizzle ORM (데이터베이스)
├── JWT + Cookie 인증
├── Multer (파일 업로드)
└── Winston (로깅)

Database:
├── PostgreSQL (Neon Serverless)
└── Drizzle Kit (마이그레이션)

Cloud Services:
├── Google Cloud Storage (파일 저장)
├── Firebase Admin SDK (GCS 인증)
└── Sentry (에러 모니터링)

AI Services:
├── TopMediai API (음악 생성)
├── OpenAI GPT-Image-1 (이미지 생성)
├── Google Gemini 2.5 Flash (이미지 생성)
├── Google Gemini 3.0 Pro (이미지 생성)
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
│   │   │   ├── admin/          # 관리자 컴포넌트
│   │   │   ├── ui/             # shadcn/ui 컴포넌트
│   │   │   └── ...
│   │   ├── hooks/              # 커스텀 훅
│   │   ├── lib/                # 유틸리티
│   │   ├── pages/              # 페이지 컴포넌트
│   │   └── App.tsx             # 메인 앱
│   └── index.html
│
├── server/                     # 백엔드
│   ├── routes/                 # 라우터 모듈 (24개)
│   ├── services/               # 비즈니스 로직
│   ├── middleware/             # 미들웨어
│   ├── utils/                  # 유틸리티
│   ├── routes.ts               # 통합 라우터
│   └── index.ts                # 서버 진입점
│
├── shared/                     # 공유 모듈
│   ├── schema.ts               # DB 스키마 (44개 테이블)
│   └── constants.ts            # 공통 상수
│
├── db/                         # 데이터베이스
│   ├── index.ts                # DB 연결
│   └── seed.ts                 # 시드 데이터
│
└── docs/                       # 문서
```

---

## 3. 백엔드 아키텍처

### 3.1 라우터 모듈 목록 (24개)
| 번호 | 파일명 | 등록 경로 | 주요 기능 |
|------|--------|----------|-----------|
| 1 | auth.ts | /api/auth | 로그인, 회원가입, JWT 토큰, 비밀번호 재설정 |
| 2 | admin-routes.ts | registerAdminRoutes() | 관리자 전용 통합 기능 |
| 3 | admin-snapshot.ts | /api/admin/snapshot | 스냅샷 프롬프트 CRUD |
| 4 | milestone-routes.ts | /api/milestones | 마일스톤 관리 및 참여형 신청 |
| 5 | mission-routes.ts | /api/missions | 미션 시스템 (사용자/관리자) |
| 6 | image.ts | /api/images | 이미지 CRUD 및 AI 생성 |
| 7 | music-engine-routes.ts | /api/music, /api/music-engine | 음악 생성 3단계 워크플로우 |
| 8 | snapshot.ts | /api/snapshot | AI 스냅샷 생성 |
| 9 | chat-routes.ts | /api/chat | AI 채팅, 페르소나 기반 대화 |
| 10 | concepts.ts | / (루트) | 이미지 컨셉 관리 |
| 11 | gallery.ts | /api/gallery | 갤러리 통합 (음악/이미지/스냅샷) |
| 12 | banner-migration.ts | /api/admin/banner-migration | 배너 마이그레이션 |
| 13 | hospital-routes.ts | registerHospitalRoutes() | 병원 관리, 병원 코드 |
| 14 | upload.ts | /api/upload | 파일 업로드 (이미지, 문서) |
| 15 | collage.ts | /api/collage | 콜라주 이미지 생성 |
| 16 | google-oauth.ts | /api/google-oauth | Google OAuth 인증 |
| 17 | service-catalog.ts | /api/service-catalog | 서비스 카테고리/항목 관리 |
| 18 | user-settings.ts | /api/user-settings | 사용자 설정 (테마, 언어) |
| 19 | profile.ts | /profile | 사용자 프로필 관리 |
| 20 | exports.ts | / (루트) | 데이터 내보내기 |
| 21 | misc-routes.ts | / (루트) | 기타 유틸리티 라우트 |
| 22 | public-routes.ts | registerPublicRoutes() | 공개 API (배너, 컨셉 등) |
| 23 | placeholder.ts | /api/placeholder | 플레이스홀더 이미지 생성 |
| 24 | test-routes.ts | /api/test (개발 전용) | 테스트 엔드포인트 |

### 3.2 인증 및 권한 시스템
```typescript
// 6단계 멤버십 시스템
type MembershipLevel = 
  | "free"           // 무료 회원
  | "pro"            // 유료 회원
  | "membership"     // 병원 제휴 회원
  | "hospital_admin" // 병원 관리자
  | "admin"          // 시스템 관리자
  | "superadmin";    // 최고 관리자

// 권한 미들웨어
requireAuth()           // 로그인 필수
requireAdmin()          // admin 이상
requireHospitalAdmin()  // hospital_admin 이상
requireSuperAdmin()     // superadmin만
```

### 3.3 주요 서비스 모듈
| 서비스 | 파일 | 기능 |
|--------|------|------|
| TopMediaiService | topMediaiService.ts | 음악 생성 3단계 워크플로우 |
| GeminiSnapshotService | geminiSnapshotService.ts | Gemini 기반 스냅샷 생성 |
| SnapshotPromptService | snapshotPromptService.ts | DB 프롬프트 관리 |
| GCSService | gcsService.ts | GCS 파일 업로드/관리 |
| ImageProcessingService | imageProcessingService.ts | 이미지 변환/압축 |
| NotificationService | notificationService.ts | 알림 생성/발송 |

---

## 4. 데이터베이스 스키마

### 4.1 테이블 목록 (44개)

#### 사용자 및 인증 (9개)
| 테이블 | 설명 |
|--------|------|
| users | 사용자 기본 정보 (이메일, 비밀번호, 멤버십 등) |
| roles | 역할 정의 |
| user_roles | 사용자-역할 매핑 (다대다) |
| refresh_tokens | JWT 리프레시 토큰 저장 |
| password_reset_tokens | 비밀번호 재설정 토큰 |
| user_settings | 사용자 설정 (테마, 언어) |
| user_notification_settings | 사용자별 알림 설정 |
| pregnancy_profiles | 임신 정보 프로필 (주차, 예정일 등) |
| hospital_members | 병원-회원 매핑 관계 |

#### 병원 관리 (2개)
| 테이블 | 설명 |
|--------|------|
| hospitals | 병원 정보 (이름, 주소, 상태 등) |
| hospital_codes | 병원 등록 코드 (master/limited/qr_unlimited/qr_limited) |

#### 콘텐츠 생성 (6개)
| 테이블 | 설명 |
|--------|------|
| music | 생성된 음악 (TopMediai 워크플로우) |
| images | 생성된 이미지 (AI 변환 결과) |
| saved_chats | 저장된 AI 채팅 대화 |
| collages | 콜라주 이미지 |
| snapshot_prompts | AI 스냅샷 프롬프트 (420개 DB 관리) |
| music_styles | 음악 스타일 정의 |

#### 컨셉 및 스타일 (5개)
| 테이블 | 설명 |
|--------|------|
| concepts | 이미지 생성 컨셉 (프롬프트 템플릿 포함) |
| concept_categories | 컨셉 카테고리 |
| image_styles | 이미지 스타일 정의 |
| style_templates | 스타일 템플릿 (Dream Book용) |
| global_prompt_rules | 전역 프롬프트 규칙 (JSON) |

#### 페르소나 (2개)
| 테이블 | 설명 |
|--------|------|
| personas | AI 채팅 페르소나 캐릭터 |
| persona_categories | 페르소나 카테고리 |

#### 마일스톤 시스템 (5개)
| 테이블 | 설명 |
|--------|------|
| milestones | 마일스톤 정의 (info/campaign 타입) |
| milestone_categories | 마일스톤 카테고리 |
| user_milestones | 사용자 마일스톤 완료 기록 |
| milestone_applications | 참여형 마일스톤 신청 (상태: pending/approved/rejected) |
| milestone_application_files | 마일스톤 첨부파일 (GCS 저장) |

#### 미션 시스템 (5개)
| 테이블 | 설명 |
|--------|------|
| mission_categories | 미션 카테고리 |
| theme_missions | 주제 미션 (visibilityType: public/hospital) |
| sub_missions | 세부 미션 슬롯 (submissionTypes 다중 지원) |
| user_mission_progress | 사용자 미션 진행 상황 (5단계 상태) |
| sub_mission_submissions | 세부 미션 제출 기록 (잠금 기능 포함) |

#### A/B 테스트 (3개)
| 테이블 | 설명 |
|--------|------|
| ab_tests | A/B 테스트 정의 |
| ab_test_variants | 테스트 변형 (프롬프트별) |
| ab_test_results | 테스트 결과 기록 |

#### UI 관리 (4개)
| 테이블 | 설명 |
|--------|------|
| banners | 메인 배너 (슬라이드) |
| small_banners | 작은 배너 |
| service_categories | 서비스 카테고리 (사이드바 메뉴) |
| service_items | 서비스 항목 (메뉴 아이템) |

#### 알림 시스템 (2개)
| 테이블 | 설명 |
|--------|------|
| notifications | 알림 내역 (읽음 상태 관리) |
| notification_settings | 알림 설정 (카테고리별 ON/OFF) |

#### 시스템 설정 (1개)
| 테이블 | 설명 |
|--------|------|
| ai_model_settings | AI 모델 설정 (Singleton, ID=1 고정) |

### 4.2 핵심 스키마 상세

#### users 테이블
```typescript
{
  id: serial PRIMARY KEY,
  username: varchar(100) UNIQUE NOT NULL,
  password: varchar(255) NOT NULL,
  email: varchar(255) UNIQUE,
  fullName: varchar(100),
  phoneNumber: varchar(20),
  birthdate: timestamp,
  hospitalId: integer REFERENCES hospitals(id),
  membershipLevel: varchar(20) DEFAULT 'free',
  isActive: boolean DEFAULT true,
  firebaseUid: varchar(255) UNIQUE,
  createdAt: timestamp DEFAULT NOW(),
  updatedAt: timestamp DEFAULT NOW()
}
```

#### snapshot_prompts 테이블
```typescript
{
  id: serial PRIMARY KEY,
  category: text NOT NULL,  // 'individual', 'couple', 'family'
  type: text NOT NULL,      // 'daily', 'travel', 'film'
  gender: text,             // 'male', 'female', null
  region: text,             // 'domestic', 'international'
  season: text,             // 'spring', 'summer', 'fall', 'winter'
  prompt: text NOT NULL,
  isActive: boolean DEFAULT true,
  usageCount: integer DEFAULT 0,
  order: integer DEFAULT 0,
  createdAt: timestamp DEFAULT NOW(),
  updatedAt: timestamp DEFAULT NOW()
}
// 총 420개 프롬프트: Individual(210), Couple(105), Family(105)
```

#### theme_missions 테이블
```typescript
{
  id: serial PRIMARY KEY,
  missionId: text UNIQUE NOT NULL,
  title: text NOT NULL,
  description: text NOT NULL,
  categoryId: text REFERENCES mission_categories(categoryId),
  headerImageUrl: text,
  visibilityType: text DEFAULT 'public',  // 'public', 'hospital'
  hospitalId: integer REFERENCES hospitals(id),
  startDate: timestamp,
  endDate: timestamp,
  isActive: boolean DEFAULT true,
  order: integer DEFAULT 0,
  createdAt: timestamp DEFAULT NOW(),
  updatedAt: timestamp DEFAULT NOW()
}
```

---

## 5. 주요 시스템 상세

### 5.1 AI 스냅샷 시스템

#### 5.1.1 개요
3개의 AI 모델을 활용한 인물 사진 생성 시스템. 데이터베이스 기반 420개 프롬프트로 다양한 스타일 제공.

#### 5.1.2 지원 모델
| 모델 | 코드명 | 지원 비율 | 해상도 |
|------|--------|-----------|--------|
| OpenAI GPT-Image-1 | openai | 1:1, 2:3, 3:2 | 1024px |
| Gemini 2.5 Flash | gemini | 1:1, 9:16, 16:9 | 1024px |
| Gemini 3.0 Pro | gemini_3 | 10종 | 1K/2K/4K |

#### 5.1.3 프롬프트 분류
```
카테고리(category):
├── individual (210개)
│   ├── male (105개)
│   └── female (105개)
├── couple (105개)
└── family (105개)

타입(type):
├── daily (일상)
├── travel (여행)
└── film (영화 스타일)

선택 모드:
├── daily, travel, film (단일 선택)
└── mix (무작위 혼합)
```

#### 5.1.4 얼굴 보존 기능
모든 프롬프트에 얼굴 보존 지시문 포함:
- 여성: "Maintain the exact facial features and identity of the woman from the reference image."
- 남성: "Maintain the exact facial features and identity of the man from the reference image."
- 커플: "Preserve the exact facial features and identities of both people from the reference images."
- 가족: "Preserve the exact facial features and identities of all family members from the reference images."

#### 5.1.5 API 엔드포인트
```
POST /api/snapshot/generate
  - body: { personaType, styleSelection, model, gender, imageUrls }
  - response: { success, imageUrl, prompt }

GET /api/snapshot/prompts
  - query: { category, type, gender, limit }
  - response: { prompts[] }

GET /api/admin/snapshot/prompts
  - 관리자 프롬프트 목록

POST /api/admin/snapshot/prompts
  - 프롬프트 추가

PATCH /api/admin/snapshot/prompts/:id
  - 프롬프트 수정

DELETE /api/admin/snapshot/prompts/:id
  - 프롬프트 삭제
```

### 5.2 미션 시스템

#### 5.2.1 개요
스타벅스 프리퀀시 모델 기반의 슬롯형 미션 시스템. 사용자가 테마 미션 내 세부 미션들을 완료하며 진행률 추적.

#### 5.2.2 데이터 구조
```
ThemeMission (주제 미션)
├── SubMission[] (세부 미션 - 슬롯)
│   ├── title
│   ├── submissionTypes: ["file", "link", "text", "review", "image"]
│   ├── requireReview: boolean
│   └── order
└── UserMissionProgress (진행 상황)
    ├── status: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected'
    ├── progressPercent: 0-100
    └── completedSubMissions / totalSubMissions
```

#### 5.2.3 제출 타입
| 타입 | 설명 | 데이터 형식 |
|------|------|-------------|
| file | 파일 URL | { fileUrl: string } |
| link | 외부 링크 | { linkUrl: string } |
| text | 텍스트 내용 | { textContent: string } |
| review | 별점 리뷰 | { rating: number, content: string } |
| image | 이미지 URL | { imageUrl: string } |

#### 5.2.4 상태 흐름
```
not_started → in_progress → submitted → approved/rejected
                   ↑                         ↓
                   ←─────────────────────────←
```

#### 5.2.5 공개 범위 시스템
```
visibilityType: 'public' | 'hospital'
- public: 모든 사용자에게 표시
- hospital: hospitalId로 지정된 병원 회원에게만 표시
```

#### 5.2.6 기간 기반 상태 배지
```typescript
function getMissionPeriodStatus(startDate, endDate) {
  const now = new Date();
  if (startDate && now < startDate) return '준비 중';
  if (endDate && now > endDate) return '마감';
  return '진행 중';
}
```

#### 5.2.7 API 엔드포인트
```
사용자 API:
GET /api/missions
  - 미션 목록 조회 (병원 필터링 적용)

GET /api/missions/:missionId
  - 미션 상세 조회 (진행 상황 포함)

POST /api/missions/:missionId/sub-missions/:subMissionId/submit
  - 세부 미션 제출

관리자 API:
GET /api/admin/missions
  - 관리자 미션 목록

POST /api/admin/missions
  - 미션 생성

PATCH /api/admin/missions/:id
  - 미션 수정

DELETE /api/admin/missions/:id
  - 미션 삭제

GET /api/admin/missions/reviews
  - 검수 대기 목록

POST /api/admin/missions/reviews/:submissionId/approve
  - 제출 승인

POST /api/admin/missions/reviews/:submissionId/reject
  - 제출 거절
```

### 5.3 음악 생성 시스템

#### 5.3.1 워크플로우
```
1단계: 요청 생성 (createMusicTask)
   - 제목, 스타일, 가사 정보 수집
   - DB에 pending 상태로 저장

2단계: 생성 요청 (submitToEngine)
   - TopMediai API 호출
   - song_id 획득

3단계: 폴링 및 완료 (pollAndComplete)
   - 생성 상태 확인 (최대 10분)
   - 완료 시 GCS 업로드
   - DB 업데이트 (done)
```

#### 5.3.2 가사 생성
```
옵션 1: 사용자 입력 가사
옵션 2: AI 자동 생성 (generateLyrics: true)
  - OpenAI GPT-4o 활용
  - 아기 이름 포함 옵션
```

#### 5.3.3 엔진 설정
```typescript
{
  engine: 'topmedia',
  gender: 'female' | 'male' | 'child' | 'auto',
  durationSec: 60 | 120 | 180 | 240,
  style: MusicStyle
}
```

### 5.4 이미지 생성 시스템

#### 5.4.1 생성 방식
- **image_upload**: 사용자 이미지 기반 변환
- **text_only**: 텍스트 프롬프트 기반 생성

#### 5.4.2 컨셉 설정
```typescript
{
  conceptId: string,
  title: string,
  promptTemplate: string,
  availableModels: ['openai', 'gemini', 'gemini_3'],
  availableAspectRatios: {
    openai: ['1:1', '2:3', '3:2'],
    gemini: ['1:1', '9:16', '16:9'],
    gemini_3: ['16:9', '9:16', ...]
  },
  visibilityType: 'public' | 'hospital',
  hospitalId: number
}
```

### 5.5 파일 저장 시스템

#### 5.5.1 GCS 저장 구조
```
bucket: changjoai-storage
├── music/
│   └── {userId}/{filename}.mp3
├── images/
│   ├── {userId}/{filename}.webp
│   └── thumbnails/{filename}_thumb.webp
├── snapshots/
│   └── {userId}/{filename}.webp
├── uploads/
│   └── {userId}/{filename}
└── banners/
    └── {filename}
```

#### 5.5.2 URL 영구화
```typescript
// 모든 파일 업로드 시 영구 공개 URL 생성
ensurePermanentUrl(gcsPath) → 'https://storage.googleapis.com/...'

// 이미지 저장 시 자동 WebP 변환
saveImageToGCS(buffer, userId, prefix) → {
  url: 'https://...',
  thumbnailUrl: 'https://...'
}
```

---

## 6. 프론트엔드 아키텍처

### 6.1 주요 페이지 목록
| 경로 | 페이지 | 설명 |
|------|--------|------|
| / | Home | 메인 페이지 |
| /login | Login | 로그인 |
| /register | Register | 회원가입 |
| /snapshot | Snapshot | AI 스냅샷 생성 |
| /missions | Missions | 미션 목록 |
| /missions/:id | MissionDetail | 미션 상세 |
| /music-creation | MusicCreation | 음악 생성 |
| /image-generator | ImageGenerator | 이미지 생성 |
| /gallery-simplified | Gallery | 갤러리 |
| /chat | Chat | AI 채팅 |
| /profile | Profile | 프로필 |
| /admin | AdminDashboard | 관리자 대시보드 |
| /admin/missions | AdminMissions | 미션 관리 |
| /admin/mission-reviews | MissionReviews | 미션 검수 |
| /admin/users | AdminUsers | 사용자 관리 |
| /admin/hospitals | AdminHospitals | 병원 관리 |
| /admin/snapshot-prompts | SnapshotPrompts | 스냅샷 프롬프트 관리 |

### 6.2 주요 컴포넌트
```
components/
├── admin/
│   ├── MissionManagement.tsx    # 미션 CRUD
│   ├── MissionReviewDashboard.tsx # 검수 대시보드
│   ├── SnapshotPromptAdmin.tsx  # 프롬프트 관리
│   └── UserManagement.tsx       # 사용자 관리
├── snapshot/
│   ├── SnapshotGenerator.tsx    # 스냅샷 생성기
│   ├── PersonaSelector.tsx      # 인물 유형 선택
│   └── StyleSelector.tsx        # 스타일 선택
├── mission/
│   ├── MissionCard.tsx          # 미션 카드
│   ├── MissionProgress.tsx      # 진행률 표시
│   └── SubmissionForm.tsx       # 제출 폼
└── ui/
    └── (shadcn/ui 컴포넌트들)
```

### 6.3 상태 관리
```typescript
// TanStack Query 패턴
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/missions'],
  enabled: !!user
});

// 변이 후 캐시 무효화
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/missions', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/missions'] });
  }
});
```

---

## 7. 보안

### 7.1 인증 보안
- JWT 토큰: HTTP-only 쿠키 저장
- 리프레시 토큰: 7일 만료, DB 저장
- 액세스 토큰: 15분 만료
- bcrypt: 비밀번호 해싱 (salt round 10)

### 7.2 API 보안
- Rate Limiting: express-rate-limit
- CORS: 허용 도메인 제한
- Helmet: 보안 헤더 설정
- 입력 검증: Zod 스키마

### 7.3 데이터 접근 제어
```typescript
// 병원 데이터 격리
function effectiveHospitalFilter(user, requestedHospitalId?) {
  if (user.membershipLevel === 'superadmin') {
    return requestedHospitalId || null; // 전체 접근 가능
  }
  return user.hospitalId; // 본인 병원만
}
```

### 7.4 파일 업로드 보안
- Multer: 파일 타입/크기 제한
- MIME 타입 검증
- 파일명 UUID 변환
- GCS 권한 관리

---

## 8. 성능 최적화

### 8.1 데이터베이스
- 인덱스: 검색 빈도 높은 컬럼
- 관계 쿼리: Drizzle with() 활용
- 페이지네이션: limit/offset

### 8.2 이미지 처리
- WebP 변환: 용량 50-70% 절감
- 썸네일 자동 생성: 갤러리 로딩 최적화
- Sharp 라이브러리 활용

### 8.3 API 응답
- 조건부 데이터 로딩
- 캐시 무효화 전략
- 에러 응답 표준화

---

## 9. 시스템 취약점 및 개선사항

### 9.1 보안 취약점

#### 9.1.1 높은 우선순위
| 항목 | 현상 | 권장 조치 |
|------|------|-----------|
| API 키 노출 | 환경변수 직접 사용 | Vault 또는 시크릿 매니저 도입 |
| SQL 인젝션 | ORM 사용 중이나 raw SQL 일부 존재 | 모든 쿼리 파라미터화 검증 |
| CORS 설정 | 개발 환경에서 와일드카드 사용 | 프로덕션 도메인 명시적 화이트리스트 |

#### 9.1.2 중간 우선순위
| 항목 | 현상 | 권장 조치 |
|------|------|-----------|
| 파일 업로드 검증 | MIME 타입만 검사 | 파일 내용 검증 (magic bytes) |
| 로그 관리 | 민감 정보 로깅 가능성 | 로그 필터링 강화 |
| 세션 관리 | JWT 블랙리스트 미구현 | 토큰 폐기 메커니즘 추가 |

### 9.2 성능 개선사항

#### 9.2.1 데이터베이스
| 항목 | 현상 | 권장 조치 |
|------|------|-----------|
| N+1 쿼리 | 일부 관계 쿼리에서 발생 | with() 적극 활용 |
| 인덱스 부족 | 일부 검색 쿼리 느림 | 쿼리 분석 후 인덱스 추가 |
| 연결 풀링 | 기본 설정 사용 | 부하 테스트 후 최적화 |

#### 9.2.2 프론트엔드
| 항목 | 현상 | 권장 조치 |
|------|------|-----------|
| 번들 크기 | 초기 로딩 느림 | 코드 스플리팅 강화 |
| 이미지 로딩 | 갤러리 페이지 느림 | 가상 스크롤 또는 무한 스크롤 |
| 캐시 전략 | 기본 캐시만 사용 | staleTime 최적화 |

### 9.3 기능 개선사항

#### 9.3.1 미션 시스템
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 오프라인 지원 | PWA 캐시 전략 | 중간 |
| 일괄 승인 | 여러 제출 한번에 처리 | 높음 |
| 통계 대시보드 | 미션 참여율 분석 | 중간 |

#### 9.3.2 AI 스냅샷
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 생성 이력 | 사용자별 생성 기록 저장 | 높음 |
| 프롬프트 A/B 테스트 | 프롬프트 효과 측정 | 중간 |
| 배치 생성 | 여러 이미지 동시 생성 | 낮음 |

#### 9.3.3 음악 생성
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 생성 큐 관리 | 동시 요청 제한 및 큐잉 | 높음 |
| 폴백 엔진 | TopMediai 실패 시 대안 | 중간 |
| 미리듣기 | 짧은 샘플 먼저 생성 | 낮음 |

### 9.4 인프라 개선사항

| 항목 | 현상 | 권장 조치 |
|------|------|-----------|
| 모니터링 | Sentry만 사용 | APM 도구 추가 (DataDog, New Relic) |
| 백업 | 자동 백업 미설정 | 일일 DB 백업 스케줄 |
| CDN | GCS 직접 서빙 | CloudFront 또는 Cloud CDN |
| 로드 밸런싱 | 단일 인스턴스 | 멀티 인스턴스 + 로드 밸런서 |
| 스테이징 환경 | 프로덕션만 존재 | 스테이징 환경 구축 |

---

## 10. 환경 변수

### 10.1 필수 환경 변수
```bash
# 데이터베이스
DATABASE_URL=postgresql://...

# 인증
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# GCS
GCS_PROJECT_ID=...
GCS_BUCKET_NAME=changjoai-storage
GCS_CREDENTIALS=... (Base64 인코딩)

# AI 서비스
OPENAI_API_KEY=...
GOOGLE_GEMINI_API_KEY=...
TOPMEDIA_API_KEY=...

# 모니터링
SENTRY_DSN=...
```

### 10.2 선택적 환경 변수
```bash
# 이메일
SENDGRID_API_KEY=...

# 결제
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...

# Firebase
FIREBASE_ADMIN_SDK_CONFIG=...
```

---

## 11. 배포

### 11.1 빌드 명령어
```bash
# 프론트엔드 빌드
npm run build

# 데이터베이스 동기화
npm run db:push

# 시드 데이터
npm run db:seed

# 개발 서버
npm run dev

# 프로덕션 서버
npm start
```

### 11.2 Replit 배포
- Deployment: Autoscale
- Build Command: npm run build
- Run Command: npm start
- Port: 5000

---

## 12. 변경 이력

### 2025년 12월 (v2.0)
- AI 스냅샷 시스템 추가 (3개 AI 모델, 420개 프롬프트)
- 미션 시스템 구현 (스타벅스 프리퀀시 모델)
- 미션 검수 대시보드 추가 (병원 필터링 지원)
- 시스템 설정 테이블 추가 (AI 모델 제어)
- 라우터 모듈 24개로 확장
- 데이터베이스 테이블 44개로 확장

### 2025년 10월 (v1.0)
- 초기 시스템 구축
- 음악 생성 시스템
- 이미지 변환 시스템
- AI 채팅 시스템
- 갤러리 시스템

---

**문서 작성자:** AI Agent  
**최종 검토일:** 2025년 12월 18일
