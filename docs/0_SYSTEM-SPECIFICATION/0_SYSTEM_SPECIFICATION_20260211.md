# 창조AI V2 - 종합 시스템 명세서
**버전:** 3.0  
**작성일:** 2026년 2월 11일  
**문서 상태:** Production Ready  
**이전 버전:** v2.5 (2026-01-19)

---

## 1. 시스템 개요

### 1.1 프로젝트 소개
창조AI V2는 산후조리원 및 산부인과 병원을 위한 AI 기반 문화센터 플랫폼입니다. 임산부와 가족들에게 AI 음악 생성, AI 이미지 변환, AI 스냅샷 생성, 제작소(포토북/엽서/파티), 미션 시스템 등 다양한 창작 서비스를 제공합니다.

### 1.2 핵심 기능 요약
| 기능 | 설명 | 상태 |
|------|------|------|
| AI 음악 생성 | TopMediai API 기반 맞춤형 태교 음악 생성 | Production |
| AI 이미지 변환 | 이미지 스타일 변환 및 캐릭터 생성 | Production |
| AI 스냅샷 | 3개 AI 모델, 420개 프롬프트 기반 인물 사진 생성 | Production |
| 제작소 시스템 | 포토북/엽서/파티 에디터 (Fabric.js 기반) | Production |
| 미션 시스템 | 스타벅스 프리퀀시 모델 기반 슬롯형 미션 (제작소 연동) | Production |
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
├── Firebase Storage (클라이언트 직접 업로드)
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
├── Google Gemini 2.5 Flash (이미지 생성)
├── Google Gemini 3.0 Pro (이미지 생성)
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
│   │   │   ├── admin/          # 관리자 컴포넌트 (21개)
│   │   │   ├── common/         # 공통 컴포넌트
│   │   │   ├── photobook-v2/   # 포토북 에디터 컴포넌트
│   │   │   ├── postcard/       # 엽서 에디터 컴포넌트
│   │   │   ├── product-editor/ # 제품 에디터 공통
│   │   │   ├── music/          # 음악 관련 컴포넌트
│   │   │   ├── ui/             # shadcn/ui 컴포넌트
│   │   │   └── ...
│   │   ├── hooks/              # 커스텀 훅 (25개)
│   │   ├── lib/                # 유틸리티
│   │   ├── pages/              # 페이지 컴포넌트 (35+개)
│   │   ├── services/           # 프론트엔드 서비스
│   │   │   ├── exportService.ts        # PDF/이미지 내보내기
│   │   │   ├── imageIngestionService.ts # 중앙집중식 이미지 처리
│   │   │   └── thumbnailService.ts     # 썸네일 생성
│   │   ├── stores/             # Zustand 스토어
│   │   ├── types/              # TypeScript 타입 정의
│   │   └── App.tsx             # 메인 앱
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
└── docs/                       # 문서
```

---

## 3. 백엔드 아키텍처

### 3.1 라우터 모듈 목록 (32개)
| 번호 | 파일명 | 등록 경로 | 주요 기능 |
|------|--------|----------|-----------|
| 1 | auth.ts | /api/auth | 로그인, 회원가입, JWT 토큰, 비밀번호 재설정 |
| 2 | admin-routes.ts | registerAdminRoutes() | 관리자 전용 통합 기능 |
| 3 | admin-snapshot.ts | /api/admin/snapshot | 스냅샷 프롬프트 CRUD |
| 4 | milestone-routes.ts | /api/milestones | 마일스톤 관리 및 참여형 신청 |
| 5 | mission-routes.ts | /api/missions | 미션 시스템 (사용자/관리자/검수/제작소연동) |
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
| 25 | **photobook.ts** | /api/photobook | 포토북 프로젝트 CRUD, 버전 관리 |
| 26 | **photobook-materials.ts** | /api/photobook | 포토북 배경/아이콘 소재 관리 |
| 27 | **products.ts** | /api/products | 엽서/파티 제품 프로젝트 관리 |
| 28 | **editor-upload.ts** | /api/editor-upload | 에디터 전용 이미지 업로드 (듀얼 해상도) |
| 29 | **upscale.ts** | /api/upscale | 이미지 업스케일 (Vertex AI Imagen) |
| 30 | **background-removal.ts** | /api/background-removal | 배경 제거 (BiRefNet) |
| 31 | **image-extractor.ts** | /api/image-extractor | 이미지 추출기 |
| 32 | **export.ts** | /api/export | 통합 내보내기 설정 및 프록시 |

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
| **UpscaleService** | upscaleService.ts | Vertex AI Imagen 업스케일 |
| **BackgroundRemovalService** | backgroundRemoval.ts | BiRefNet 배경 제거 |
| **CollageServiceV2** | collageServiceV2.ts | 콜라주 생성 v2 |

---

## 4. 데이터베이스 스키마

### 4.1 테이블 목록 (55개)

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
| sub_missions | 세부 미션 슬롯 (submissionTypes 다중 지원, **studioDpi** 필드 추가) |
| user_mission_progress | 사용자 미션 진행 상황 (5단계 상태) |
| sub_mission_submissions | 세부 미션 제출 기록 (잠금 기능 포함) |

#### A/B 테스트 (3개)
| 테이블 | 설명 |
|--------|------|
| ab_tests | A/B 테스트 정의 |
| ab_test_variants | 테스트 변형 (프롬프트별) |
| ab_test_results | 테스트 결과 기록 |

#### UI 관리 (6개)
| 테이블 | 설명 |
|--------|------|
| banners | 메인 배너 (슬라이드) |
| small_banners | 작은 배너 |
| service_categories | 서비스 카테고리 (사이드바 메뉴) |
| service_items | 서비스 항목 (메뉴 아이템) |
| **popular_styles** | 인기 스타일 표시 |
| **main_gallery_items** | 메인 갤러리 항목 |

#### 알림 시스템 (2개)
| 테이블 | 설명 |
|--------|------|
| notifications | 알림 내역 (읽음 상태 관리) |
| notification_settings | 알림 설정 (카테고리별 ON/OFF) |

#### 시스템 설정 (1개)
| 테이블 | 설명 |
|--------|------|
| system_settings | AI 모델 설정 (Singleton, ID=1 고정) |

#### 🆕 포토북 시스템 (6개)
| 테이블 | 설명 |
|--------|------|
| **photobook_projects** | 포토북 프로젝트 (pagesData JSON, 버전2 구조) |
| **photobook_versions** | 포토북 버전 이력 (스냅샷 저장) |
| **photobook_templates** | 포토북 템플릿 (관리자 생성) |
| **photobook_material_categories** | 포토북 소재 카테고리 |
| **photobook_backgrounds** | 포토북 배경 이미지 |
| **photobook_icons** | 포토북 아이콘/스티커 |

#### 🆕 제품 시스템 (3개)
| 테이블 | 설명 |
|--------|------|
| **product_categories** | 제품 카테고리 (postcard, party) |
| **product_variants** | 제품 규격 (크기, bleed, DPI 설정) |
| **product_projects** | 제품 프로젝트 (designsData JSON) |

### 4.2 핵심 스키마 상세

#### photobook_projects 테이블 (신규)
```typescript
{
  id: serial PRIMARY KEY,
  userId: integer REFERENCES users(id),
  hospitalId: integer REFERENCES hospitals(id),
  title: text NOT NULL DEFAULT '새 포토북',
  description: text,
  templateId: integer REFERENCES photobook_templates(id),
  canvasWidth: integer DEFAULT 2100,
  canvasHeight: integer DEFAULT 2100,
  pagesData: jsonb, // 버전2: { version, editorDpi, editorState: { spreads, albumSize, assets } }
  pageCount: integer DEFAULT 1,
  thumbnailUrl: text,
  status: text DEFAULT 'draft', // draft, completed, archived
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### product_projects 테이블 (신규)
```typescript
{
  id: serial PRIMARY KEY,
  userId: integer REFERENCES users(id),
  categoryId: integer REFERENCES product_categories(id),
  variantId: integer REFERENCES product_variants(id),
  title: text NOT NULL DEFAULT '새 프로젝트',
  designsData: jsonb, // { designs: [], variantConfig: {} }
  thumbnailUrl: text,
  status: text DEFAULT 'draft',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### sub_missions 테이블 (확장)
```typescript
{
  // 기존 필드...
  submissionTypes: text[] NOT NULL, // ["file", "link", "text", "review", "image", "studio_submit"]
  studioDpi: integer DEFAULT 300, // 제작소 PDF 품질 (150 또는 300)
  // ...
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

### 5.2 🆕 제작소 시스템 (Studio System)

#### 5.2.1 개요
Fabric.js 기반 캔버스 에디터로 포토북, 엽서, 파티 제품을 제작하는 시스템. 드래그앤드롭, 이미지 편집, 텍스트 추가, PDF 내보내기 지원.

#### 5.2.2 에디터 종류
| 에디터 | 페이지 | 특징 |
|--------|--------|------|
| 포토북 | photobook-v2.tsx | 다중 스프레드, 버전 관리, 앨범 크기 선택 |
| 엽서 | postcard.tsx | 단면/양면, 다양한 규격, 수량 설정 |
| 파티 | party.tsx | 파티 용품 디자인, 다양한 규격 |

#### 5.2.3 핵심 컴포넌트
```
photobook-v2/
├── EditorCanvas.tsx     # 캔버스 렌더링 (Fabric.js)
├── DraggableObject.tsx  # 드래그 가능 오브젝트
├── Sidebar.tsx          # 이미지/배경/아이콘 선택
├── TopBar.tsx           # 도구 모음 (실행취소, 확대 등)
├── PageStrip.tsx        # 페이지 네비게이션
└── MaterialPickerModal.tsx # 소재 선택 모달

product-editor/
├── PostcardEditorCanvas.tsx  # 엽서/파티 캔버스
├── PostcardTopBar.tsx        # 제품 에디터 도구모음
├── DesignStrip.tsx           # 디자인 목록
└── DownloadFormatModal.tsx   # 내보내기 형식 선택
```

#### 5.2.4 데이터 구조

**포토북 pagesData (버전 2)**
```typescript
{
  version: 2,
  editorDpi: 150, // 에디터 해상도
  editorState: {
    scale: number,
    assets: Asset[],           // 업로드된 이미지
    spreads: Spread[],         // 스프레드 배열
    albumSize: {
      id: string,
      name: string,
      dpi: number,
      widthInches: number,     // 단일 페이지 너비
      heightInches: number
    },
    currentSpreadIndex: number,
    showBleed: boolean
  }
}

interface Spread {
  id: string;
  objects: CanvasObject[];
  background: string;
  backgroundLeft?: string;
  backgroundRight?: string;
  pageLeftId: string;
  pageRightId: string;
}
```

**제품 designsData**
```typescript
{
  designs: Design[],
  variantConfig: {
    widthMm: number,
    heightMm: number,
    bleedMm: number,
    dpi: number
  }
}

interface Design {
  id: string;
  objects: CanvasObject[];
  background: string;
  orientation: 'landscape' | 'portrait';
  quantity?: number;
}
```

#### 5.2.5 이미지 입력 시스템 (imageIngestionService)

**핵심 규칙 (필수 준수)**
1. **모든 에디터 이미지는 GCS에 저장되어야 함** - 로컬 URL, 외부 URL 사용 금지
2. **갤러리 이미지 직접 사용 절대 금지** - 반드시 `copyFromGallery()` 함수로 GCS에 복사 후 사용
3. **듀얼 해상도 저장** - 모든 이미지는 preview (1024px)와 original (원본) 두 가지 해상도로 저장
4. **반환되는 Asset은 항상 GCS URL** - previewUrl과 originalUrl 모두 GCS 경로여야 함

**API 엔드포인트**
```
POST /api/editor-upload/single       # 단일 파일 → 듀얼 해상도 업로드
POST /api/editor-upload/multiple     # 다중 파일 업로드
POST /api/editor-upload/copy-gallery # 갤러리 이미지 → GCS 복사 (필수!)
DELETE /api/editor-upload/delete     # 이미지 삭제
```

**주요 함수**
```typescript
// 디바이스 업로드
uploadFromDevice(file: File): Promise<UploadResult>
uploadMultipleFromDevice(files: File[]): Promise<MultiUploadResult>

// 갤러리에서 GCS로 복사 (갤러리 이미지 사용 시 필수 호출)
copyFromGallery(image: GalleryImageItem): Promise<UploadResult>
copyMultipleFromGallery(images: GalleryImageItem[]): Promise<MultiUploadResult>

// 삭제
deleteImage(assetId: string): Promise<DeleteResult>
```

**검증 로직**
- Export 시 모든 이미지 URL이 GCS 도메인인지 검증
- 비-GCS URL 발견 시 경고 로그 출력 및 처리 중단
- 갤러리 원본 이미지는 보호되어 직접 사용 시 권한 오류 발생

#### 5.2.6 내보내기 시스템 (exportService)
```typescript
// PDF/이미지 생성
generatePdfBlob(designs, variantConfig, options)
downloadAsPdf(designs, variantConfig, options, filename)
downloadAsImage(design, variantConfig, options, filename, format)

// 옵션
interface ExportOptions {
  format: 'pdf' | 'png' | 'jpg' | 'webp';
  qualityValue: string;  // DPI
  dpi: number;
  includeBleed: boolean;
}
```

#### 5.2.7 API 엔드포인트
```
포토북 API:
GET /api/photobook/projects          # 프로젝트 목록
POST /api/photobook/projects         # 프로젝트 생성
GET /api/photobook/projects/:id      # 프로젝트 조회
PATCH /api/photobook/projects/:id    # 프로젝트 수정
DELETE /api/photobook/projects/:id   # 프로젝트 삭제
GET /api/photobook/projects/:id/versions  # 버전 목록
POST /api/photobook/projects/:id/restore/:versionId  # 버전 복원
GET /api/photobook/templates         # 템플릿 목록
GET /api/photobook/materials         # 소재 목록

제품 API:
GET /api/products/projects           # 프로젝트 목록
POST /api/products/projects          # 프로젝트 생성
GET /api/products/projects/:id       # 프로젝트 조회
PATCH /api/products/projects/:id     # 프로젝트 수정
DELETE /api/products/projects/:id    # 프로젝트 삭제
GET /api/products/studio-gallery     # 제작소 갤러리 (미션용)

에디터 업로드 API:
POST /api/editor-upload/single       # 단일 이미지 업로드
POST /api/editor-upload/multiple     # 다중 이미지 업로드
POST /api/editor-upload/copy-gallery # 갤러리 이미지 복사
DELETE /api/editor-upload/delete     # 이미지 삭제
```

### 5.3 미션 시스템 (확장)

#### 5.3.1 제출 타입 (6종)
| 타입 | 설명 | 데이터 형식 |
|------|------|-------------|
| file | 파일 URL | { fileUrl: string } |
| link | 외부 링크 | { linkUrl: string } |
| text | 텍스트 내용 | { textContent: string } |
| review | 별점 리뷰 | { rating: number, content: string } |
| image | 이미지 URL | { imageUrl: string } |
| **studio_submit** | 제작소 작업물 | { studioProjectId, studioPreviewUrl, studioProjectTitle, studioPdfUrl } |

#### 5.3.2 제작소 연동 기능
- 관리자가 세부미션에 `studio_submit` 타입 설정
- `studioDpi` 필드로 PDF 품질 선택 (150 또는 300 DPI)
- 사용자가 제작소 갤러리에서 작업물 선택
- 자동으로 PDF 생성 후 GCS 업로드
- 검수 대시보드에서 PDF 다운로드 및 미리보기

#### 5.3.3 API 확장
```
POST /api/missions/upload-pdf           # 제작소 PDF 업로드
GET /api/products/studio-gallery        # 제작소 작업물 목록 (포토북 + 제품)
```

### 5.4 🆕 이미지 업스케일 시스템

#### 5.4.1 개요
Google Vertex AI Imagen API를 사용한 이미지 해상도 향상 시스템.

#### 5.4.2 지원 배율
- 2x, 4x 배율 지원
- 최대 4096x4096px 출력

#### 5.4.3 API 엔드포인트
```
POST /api/upscale
  - body: { imageUrl: string, scaleFactor: 2 | 4 }
  - response: { success, upscaledUrl, originalSize, newSize }
```

### 5.5 🆕 배경 제거 시스템

#### 5.5.1 개요
HuggingFace BiRefNet-portrait-ONNX 모델을 사용한 배경 제거(누끼) 시스템.

#### 5.5.2 특징
- 인물 사진 최적화
- 투명 PNG 출력
- 실시간 처리

#### 5.5.3 API 엔드포인트
```
POST /api/background-removal
  - body: { imageUrl: string }
  - response: { success, resultUrl, processingTime }
```

### 5.6 음악 생성 시스템

#### 5.6.1 워크플로우
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

### 5.7 파일 저장 시스템

#### 5.7.1 GCS 저장 구조
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
├── banners/
│   └── {filename}
├── editor/                          # 🆕 에디터 전용
│   └── {userId}/
│       ├── {timestamp}_original_{filename}.webp
│       └── {timestamp}_preview_{filename}.webp
├── photobook/                       # 🆕 포토북
│   └── materials/
│       ├── backgrounds/
│       └── icons/
└── missions/                        # 🆕 미션 PDF
    └── {userId}/{filename}.pdf
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
| /missions/:id | MissionDetail | 미션 상세 (제작소 연동) |
| /music-creation | MusicCreation | 음악 생성 |
| /image-generator | ImageGenerator | 이미지 생성 |
| /gallery-simplified | Gallery | 갤러리 |
| /chat | Chat | AI 채팅 |
| /profile | Profile | 프로필 |
| **/photobook-v2** | PhotobookV2 | 포토북 에디터 |
| **/postcard** | Postcard | 엽서 에디터 |
| **/party** | Party | 파티 에디터 |
| **/studio-gallery** | StudioGallery | 제작소 갤러리 |
| /admin | AdminDashboard | 관리자 대시보드 |
| /admin/missions | AdminMissions | 미션 관리 |
| /admin/mission-reviews | MissionReviews | 미션 검수 |

### 6.2 커스텀 훅 목록 (25개)

#### 기존 훅 (10개)
| 훅 | 파일명 | 설명 |
|-----|--------|------|
| useAuth | useAuth.ts | 인증 상태 관리 |
| useJwtAuth | useJwtAuth.ts | JWT 토큰 기반 인증 |
| useGoogleAuth | useGoogleAuth.ts | Google OAuth 인증 |
| useSystemSettings | useSystemSettings.ts | 시스템 설정 조회 |
| useModelCapabilities | useModelCapabilities.ts | AI 모델 기능 조회 |
| useToast | useToast.ts | 토스트 알림 (클래스 기반) |
| use-toast | use-toast.ts | 토스트 알림 (shadcn 스타일) |
| useTabHistory | useTabHistory.ts | 탭 히스토리 관리 |
| useModalHistory | useModalHistory.ts | 모달 히스토리 관리 |
| use-mobile | use-mobile.ts | 모바일 감지 |

#### 🆕 제작소 에디터 훅 (15개)
| 훅 | 파일명 | 설명 |
|-----|--------|------|
| useAutoArrange | useAutoArrange.ts | 제품 에디터 자동 배치 알고리즘 |
| useBeforeUnload | useBeforeUnload.ts | 브라우저 이탈 시 경고 표시 |
| useDownloadManager | useDownloadManager.ts | 다운로드 진행 상태 관리 |
| useEditorAssetActions | useEditorAssetActions.ts | 에디터 에셋 추가/삭제/복제 액션 |
| useEditorKeyboard | useEditorKeyboard.ts | 에디터 키보드 단축키 (Ctrl+Z, Delete 등) |
| useEditorMaterialsHandlers | useEditorMaterialsHandlers.ts | 배경/아이콘 소재 선택 핸들러 |
| useGalleryImageCopy | useGalleryImageCopy.ts | 갤러리→GCS 이미지 복사 (imageIngestionService 연동) |
| useObjectTransform | useObjectTransform.ts | 오브젝트 크기/위치 변환 |
| usePhotobookAutoArrange | usePhotobookAutoArrange.ts | 포토북 이미지 자동 배치 알고리즘 |
| usePinchZoom | usePinchZoom.ts | 터치 핀치 줌 제스처 처리 |
| usePointerDrag | usePointerDrag.ts | 마우스/터치 포인터 드래그 처리 |
| usePreviewRenderer | usePreviewRenderer.ts | 캔버스 미리보기 이미지 렌더링 |
| useProjectSave | useProjectSave.ts | 프로젝트 자동 저장 (디바운스 1초) |
| useSnapGuide | useSnapGuide.ts | 오브젝트 정렬 스냅 가이드라인 |
| useUnsavedChangesGuard | useUnsavedChangesGuard.ts | 저장 안됨 경고 모달 표시 |

### 6.3 프론트엔드 서비스
| 서비스 | 파일 | 설명 |
|--------|------|------|
| **exportService** | exportService.ts | PDF/이미지 내보내기, 캔버스 렌더링 |
| **imageIngestionService** | imageIngestionService.ts | 중앙집중식 이미지 업로드/복사 |
| **thumbnailService** | thumbnailService.ts | 썸네일 생성 |

### 6.4 상태 관리
```typescript
// TanStack Query 패턴
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/missions'],
  enabled: !!user
});

// Zustand 스토어
// - imageGenerationStore: 이미지 생성 상태
// - imageProcessingStore: 이미지 처리 상태
// - musicGenerationStore: 음악 생성 상태
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
- CORS: 허용 도메인 제한 (`createtree.ai.kr`, `createtree-platform-production.up.railway.app`, `PRODUCTION_DOMAIN` 환경변수)
- Helmet: 보안 헤더 설정
- CSP: Content Security Policy (외부 리소스 도메인 화이트리스트)
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
- **듀얼 해상도 저장**: preview(1024px) + original(고해상도)

### 8.3 에디터 최적화
- 프리뷰 해상도 분리: 편집 시 저해상도, 내보내기 시 고해상도
- 캔버스 가상화: 보이는 오브젝트만 렌더링
- 디바운스 저장: 변경 후 1초 대기

### 8.4 API 응답
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

### 9.2 기능 개선사항

#### 9.2.1 제작소 시스템
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 협업 기능 | 실시간 공동 편집 | 낮음 |
| 템플릿 마켓 | 사용자 템플릿 공유 | 중간 |
| 오프라인 지원 | PWA 오프라인 편집 | 중간 |

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
GOOGLE_VERTEX_PROJECT_ID=...  # 🆕 업스케일용
GOOGLE_VERTEX_LOCATION=...

# 모니터링
SENTRY_DSN=...
```

### 10.2 선택적 환경 변수
```bash
# 이메일
GMAIL_USER=...
GMAIL_APP_PASSWORD=...

# Firebase Direct Upload
ENABLE_FIREBASE_DIRECT_UPLOAD=true
VITE_ENABLE_FIREBASE_UPLOAD=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_AUTH_DOMAIN=...

# 프로덕션 도메인
PRODUCTION_DOMAIN=https://createtree.ai.kr

# HuggingFace (배경 제거)
HUGGINGFACE_API_KEY=...
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

### 11.2 Railway 배포 (프로덕션)
- **호스팅**: Railway (GitHub Push → 자동 배포)
- **빌드**: Railpack (Docker 기반)
- **서버 번들링**: esbuild (`--packages=external`)
- **진입점**: `dist/start.js` (에러 캐치 래퍼) → `dist/index.js`
- **PORT**: Railway 자동 할당 (`process.env.PORT`)
- **커스텀 도메인**: `createtree.ai.kr` (Gabia DNS CNAME)
- **SSL**: Railway 자동 발급/갱신
- **데이터베이스**: NeonDB `createtree-platform` (자체 계정, US West 2)

> ⚠️ Replit 배포는 2026-02-11 기준으로 완전 종료됨. Railway로 전면 이전.
---

## 12. 변경 이력

### 2026년 2월 (v3.0) — Railway 완전 마이그레이션

#### 인프라 마이그레이션 (Replit → 자체 관리)
| 항목 | 변경 전 (v2.5) | 변경 후 (v3.0) | 변경 사유 |
|------|-------------|-------------|----------|
| 서버 호스팅 | Replit (Autoscale) | Railway (Docker/Railpack) | Replit 구독 해지, 비용 절감, Docker 기반 안정성 |
| 도메인 | Replit 연결 | Railway + Gabia DNS CNAME | 도메인 직접 관리, SSL 자동 발급 |
| 데이터베이스 | NeonDB (Replit 프로비저닝) | NeonDB (createtree-platform, 자체 계정) | Replit 해지 시 데이터 삭제 위험 해소 |
| PORT | 5000 고정 | `process.env.PORT` (Railway 자동 할당) | Railway 환경 호환 |
| 서버 진입점 | `dist/index.js` 직접 실행 | `dist/start.js` 에러 캐치 래퍼 | ESM 모듈 로드 에러 캡처 |
| 빌드 시스템 | Replit 내장 | esbuild `--packages=external` | devDependency 런타임 분리 |

#### Firebase Direct Upload 활성화
| 항목 | 변경 전 | 변경 후 | 변경 사유 |
|------|---------|---------|----------|
| 이미지 업로드 | 서버 경유 (Multer → GCS) | 클라이언트 직접 Firebase Storage 업로드 | 서버 부하 감소, 업로드 속도 향상 |
| Firebase Token | 없음 | 로그인 시 Firebase Custom Token 발급 | 클라이언트 Firebase 인증 필요 |
| 폴백 | 없음 | Firebase 실패 시 서버 업로드 폴백 | 안정성 |
| 환경변수 | - | `ENABLE_FIREBASE_DIRECT_UPLOAD`, `VITE_ENABLE_FIREBASE_UPLOAD` | Feature flag 기반 토글 |

#### 코드 변경 사항
| 파일 | 변경 내용 |
|------|----------|
| `server/vite.ts` | Vite import를 런타임 동적 경로로 변경 (esbuild 번들 제외) |
| `server/start.ts` | 에러 캐치 래퍼 신규 (ESM 모듈 로드 에러 캡처) |
| `server/middleware/security.ts` | CSP 확장 + CORS에 Railway/createtree.ai.kr 도메인 추가 |
| `server/routes/auth.ts` | 비밀번호 재설정 URL `PRODUCTION_DOMAIN` 사용 + Firebase Custom Token 발급 |
| `client/index.html` | Replit 배지 스크립트 & 폴리필 제거 |
| `package.json` | build에 start.ts 포함, start를 start.js로 변경 |
| `.env` | DB 연결정보 새 NeonDB 계정으로 업데이트 |
| `client/src/services/firebase-upload.ts` | Firebase Storage 직접 업로드 서비스 |
| `client/src/lib/firebase.ts` | Firebase 클라이언트 SDK 초기화 |

### 2026년 1월 (v2.5)
- 🆕 제작소 시스템 추가 (포토북/엽서/파티 에디터)
- 🆕 포토북 테이블 6개 추가 (projects, versions, templates, materials, backgrounds, icons)
- 🆕 제품 테이블 3개 추가 (categories, variants, projects)
- 🆕 이미지 업스케일 기능 추가 (Vertex AI Imagen)
- 🆕 배경 제거 기능 추가 (BiRefNet-portrait-ONNX)
- 🆕 미션 시스템 확장: studio_submit 타입, studioDpi 필드
- 🆕 에디터 업로드 시스템 (듀얼 해상도)
- 🆕 통합 내보내기 서비스 (PDF/이미지)
- 🆕 커스텀 훅 14개 추가 (에디터 관련)
- 라우터 모듈 24개 → 32개 확장
- 데이터베이스 테이블 44개 → 55개 확장
- 프론트엔드 서비스 3개 추가

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

**문서 작성자:** claude Opus 44.6 AI Agent  
**최종 검토일:** 2026년 2월 11일
