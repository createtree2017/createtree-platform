# Overview

This project is an AI-powered hospital culture center application designed for maternity hospitals. It offers music generation, image creation, and milestone tracking services. The platform serves patients, hospital staff, and system administrators, aiming to enhance the hospital experience and streamline administrative tasks. Key capabilities include AI music generation via TopMediai, AI-driven image creation, interactive milestone tracking, comprehensive administrative dashboards, and AI Snapshot generation with face preservation.

## Recent Changes

### Unified Export System Implementation (2026-01-13)
- **Centralized, zero-hardcoding export architecture** for all product categories
- **Database Schema Extension:**
  - Added exportFormats, defaultDpi, supportedOrientations, supportsBleed, exportQualityOptions to productCategories table
  - All export configuration stored in database, not code
- **API Endpoints:**
  - GET /api/export/config/:categorySlug - Fetch category-specific export configuration
  - GET /api/export/proxy-image - Secure image proxy for GCS URLs (CORS bypass)
- **Client Services:**
  - `client/src/services/exportService.ts` - Format-agnostic rendering (WebP, JPEG, PDF)
  - `client/src/utils/dimensionUtils.ts` - Shared utility for dimension calculations
  - `client/src/components/common/UnifiedDownloadModal.tsx` - Dynamic modal for all categories
- **Features:**
  - Dynamic quality options from database (e.g., "고화질 150 DPI", "인쇄용 300 DPI")
  - Bleed area support toggle
  - Orientation handling (landscape/portrait)
  - Multi-page PDF export support
- **Security:** Image proxy restricts to Google Cloud Storage domains only
- **Integration:** Postcard page updated as first implementation

### Background Removal Upgrade to BiRefNet (2026-01-07)
- **Replaced imgly with BiRefNet-portrait-ONNX** (@huggingface/transformers)
- **Technical Details:**
  - Model: ZhengPeng7/BiRefNet-portrait-ONNX (HuggingFace)
  - MIT licensed, SOTA edge detection quality
  - ~973MB model size, 5-10s processing per image
- **Implementation:**
  - Lazy model loading with promise-based locking for concurrent safety
  - Correct processor output forwarding: `const inputs = await processorInstance(image); const outputs = await modelInstance(inputs);`
  - Sigmoid mask processing + resize + alpha channel application
  - Fallback tensor extraction: `outputs.output || outputs.logits || Object.values(outputs)[0]`
- **Interface:**
  - Identical function signatures maintained: `removeImageBackground(imageUrl)`, `removeBackgroundFromBuffer(buffer, filename)`
  - Same result structure: `{url, gsPath, fileName}`
- **Files:** `server/services/backgroundRemoval.ts`, `server/routes/background-removal.ts`, `server/routes/image.ts`
- **Monitoring:** Watch memory/CPU during initial model load, add alerts for model load failures

### Mission System Implementation (2025-11-06)
- **Complete Starbucks Frequency-inspired Mission System** replacing traditional milestones
- **Admin Management:**
  - Theme mission CRUD (create, read, update, delete)
  - Visibility control (public/hospital-specific via visibilityType + hospitalId)
  - Sub-mission builder with drag-and-drop reordering
  - Submission type selection (file/link/text/review)
  - Review requirement configuration
  - Hospital-specific data scoping for hospital_admin role
- **User Experience:**
  - Mission catalog page (/missions) with category filtering
  - Mission detail page with accordion sub-missions
  - Type-specific submission forms (file URL, link URL, text content, review with star rating)
  - Progress tracking (completed/total sub-missions, percentage)
  - Status badges (not_started, in_progress, submitted, approved, rejected)
- **Review Dashboard:**
  - Pending submissions table
  - Approval/rejection workflow with reviewer notes
  - Stats cards (pending, approved, rejected counts)
  - Hospital scoping for hospital_admin
- **Security:**
  - effectiveHospitalFilter scoping prevents cross-hospital data leakage
  - enabled: !!user query gating
  - Permanent approval locking (approved submissions cannot be modified)
- **API Endpoints:**
  - User: GET /missions, GET /missions/:missionId, POST /missions/:missionId/sub-missions/:subMissionId/submit
  - Admin: Full CRUD for missions, sub-missions, categories, and review operations
- **Quality Metrics:**
  - LSP error rate: 0%
  - All Architect reviews passed
  - Production-ready implementation

### Snapshot Workflow Redesign (2025-10-31)
- **Abandoned /snapshot/history page** in favor of gallery integration
- Step 4 completion page improvements:
  - Changed "이력보기" button to "갤러리이동" button
  - Gallery navigation now links to `/gallery-simplified?filter=snapshot`
  - Removed download-on-hover behavior from generated images
  - Added click-to-view viewer popup (view-only, no download)
  - All downloads handled exclusively through gallery
- Gallery page enhancements:
  - Added URL parameter support for initial filter selection
  - Example: `/gallery-simplified?filter=snapshot` automatically shows snapshot filter

### Snapshot Prompts Enhancement
- Added face preservation directives to all 210 individual prompts:
  - Female prompts (105): "Maintain the exact facial features and identity of the woman from the reference image."
  - Male prompts (105): "Maintain the exact facial features and identity of the man from the reference image."
- Fixed gender-specific language inconsistencies:
  - Female prompts: Removed all male references (man, he, his) → Updated to (woman, she, her)
  - Male prompts: Removed all female references (woman, she, her) → Updated to (man, he, his)
- **Couple prompts completed (2025-10-31)**:
  - 105 couple prompts with face preservation: "Preserve the exact facial features and identities of both people from the reference images."
  - Distribution: Daily (35), Travel (35), Film (35)
  - Database schema: category='couple', type='daily/travel/film' (matching Individual pattern)
  - All active and fully tested
  - Gender field: NULL (unisex, applies to all couple combinations)
  - API integration verified: All selection modes working (daily, travel, film, mix)
  - End-to-end testing completed successfully
- **Family prompts completed (2025-10-31)**:
  - 105 family prompts with face preservation: "Preserve the exact facial features and identities of all family members from the reference images."
  - Distribution: Daily (35), Travel (35), Film (35)
  - Database schema: category='family', type='daily/travel/film' (matching Individual/Couple pattern)
  - All active and fully tested
  - Gender field: NULL (family-friendly, applies to all family compositions)
  - API integration verified: All selection modes working (daily, travel, film, mix)
  - End-to-end testing completed successfully
- **Important schema note**: All prompts follow consistent pattern - category=persona (individual/couple/family), type=style (daily/travel/film)
- **Database totals**: Individual 210, Couple 105, Family 105 = 420 total active prompts

# User Preferences

Preferred communication style: Simple, everyday language.

# Development Notes

## Test Accounts (Development Only)
⚠️ **For development and testing purposes only**

- **Admin Account**: 9059056@gmail.com / 123456

## Debugging Guidelines

### AI Image Generation Logs
- **Location**: AI 이미지 생성 로그는 메인 워크플로우 로그에 기록됨 (`Start application`)
- **로그 검색 키워드**: 
  - Gemini 3.0: `[Gemini 3.0 Multi]`, `🚀`, `🎯`
  - Gemini 2.5: `[Gemini Multi]`, `🔥`
  - OpenAI: `[OpenAI Multi]`, `GPT-Image-1`
- **로그 파일 위치**: `/tmp/logs/Start_application_*.log`
- **로그 검색 명령어**: 
  ```bash
  grep -E "Gemini|OpenAI|Multi|이미지 변환" /tmp/logs/Start_application_*.log | tail -100
  ```
- **중요**: 워크플로우 재시작 시 이전 로그가 새 파일로 분리됨. 테스트 직후 로그 확인 필요

### Multi-Image Generation Architecture
- 다중 이미지 생성은 Express 서버에서 **동기적**으로 처리됨 (별도 백그라운드 워커 없음)
- 모든 AI API 호출 로그가 메인 워크플로우에 직접 기록됨
- 이미지 버퍼 크기와 프롬프트 미리보기가 로그에 포함됨

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state, React hooks for local state
- **Build Tool**: Vite
- **UI Components**: Radix UI primitives with custom styling

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM
- **Authentication**: JWT-based with cookie storage
- **File Uploads**: Multer
- **API Design**: RESTful endpoints
- **Modular Structure**: 16 separated router modules for core functionalities (e.g., auth, milestone, admin, image).

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM
- **File Storage**: Google Cloud Storage (GCS) for music and image files
- **Static Assets**: Local file system served via `/static` endpoint

## Authentication and Authorization
- **JWT Tokens**: Signed, HTTP-only cookies
- **Role-based Access**: Six-tier membership system (free, pro, membership, hospital_admin, admin, superadmin)
- **Hospital-based Isolation**: Data isolation per hospital
- **Permission Middleware**: Route-level authentication and role checking

## Core Services Integration

### Music Generation System
- **Primary Engine**: TopMediai API
- **Features**: Lyric generation, instrumental tracks, multiple styles, duration control
- **Workflow**: Request submission, API polling, GCS storage, database updates, background processing for GCS uploads.

### Image Generation System
- **AI Providers**: Multiple models supported
- **Categories**: Maternity photos, family photos, stickers
- **Processing Pipeline**: Generation, WebP conversion, thumbnail creation, GCS storage. Supports image-to-image transformations.

### Content Management
- **Dynamic Categories**: Configurable concept categories
- **Banner System**: Slide and small banners
- **Music Styles**: Predefined styles with prompt templates
- **Milestone System**: Interactive achievements with campaign periods

# External Dependencies

## Third-party APIs
- **TopMediai API**: Music generation
- **OpenAI GPT**: Fallback lyric generation and content enhancement
- **Google Gemini**: AI processing

## Cloud Services
- **Google Cloud Storage**: Production file storage
- **Firebase Admin SDK**: Service account management and GCS features

## Development Tools
- **Drizzle Kit**: Database migration management
- **Sharp**: Image processing
- **JWT**: Token-based authentication
- **bcrypt**: Password hashing

## Infrastructure
- **Environment Variables**: Configuration for API keys, database, credentials
- **Rate Limiting**: API endpoint protection
- **CORS Configuration**: Cross-origin request handling
- **Error Handling**: Centralized error management and logging
- **Constants Management**:
  - `shared/constants.ts`: Client/server common constants
  - `server/constants.ts`: Server-only constants