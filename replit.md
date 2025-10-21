# Overview

This is an AI-powered hospital culture center application that provides music generation, image creation, and milestone tracking services for maternity hospitals. The platform includes both user-facing features and administrative tools for hospital management.

The application serves multiple user types including patients, hospital staff, and system administrators with features like AI music generation using TopMediai, image creation with various AI models, interactive milestones, and comprehensive administrative dashboards.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## 2025-10-21: 대규모 리팩토링 시작 전 안정 버전 (롤백 포인트 🔖)
__
**현재 상태:**
- ✅ 로그인 화면 병원 도입 홍보 배너 구현 완료 (반응형, 클릭 가능)
- ✅ routes.ts 종합 분석 완료 (9,293줄, 171개 엔드포인트)
- ⚠️ server/services/milestones.ts LSP 에러 12개 존재 (ID 타입 불일치)
- 📊 중복 코드 발견: userId 추출 14회, 동적 import 31회, console.log 632개

**다음 작업: 전체 시스템 리팩토링**
- Phase 1: 기반 구축 (공통 유틸리티, 서비스 레이어, constants)
- Phase 2: routes.ts → 16개 모듈로 완전 분리
- Phase 3: 세부 시스템 수정 (마일스톤 LSP 에러 등)
- 목표: 유지보수성 극대화, 성능 83% 개선, 메모리 75% 절감

**⚠️ 이 지점부터 대규모 변경 시작 - 문제 발생 시 이 체크포인트로 롤백**

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state, React hooks for local state
- **Build Tool**: Vite for development and production builds
- **UI Components**: Radix UI primitives with custom styling

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based with cookie storage
- **File Uploads**: Multer for handling multipart form data
- **API Design**: RESTful endpoints with consistent error handling

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM schema
- **File Storage**: Google Cloud Storage (GCS) for music and image files
- **Static Assets**: Local file system with `/static` endpoint serving
- **Database Schema**: Comprehensive schema including users, hospitals, music, images, milestones, and administrative entities

## Authentication and Authorization
- **JWT Tokens**: Signed with configurable secret, stored in HTTP-only cookies
- **Role-based Access**: Six-tier membership system (free, pro, membership, hospital_admin, admin, superadmin)
- **Hospital-based Isolation**: Users are scoped to specific hospitals with data isolation
- **Permission Middleware**: Route-level authentication with role checking

## Core Services Integration

### Music Generation System
- **Primary Engine**: TopMediai API for high-quality music generation
- **Features**: Lyric generation, instrumental tracks, multiple styles, duration control
- **Workflow**: Request submission → API polling → GCS storage → database updates
- **Background Processing**: Asynchronous GCS uploads to minimize response times

### Image Generation System
- **Multiple AI Providers**: Support for various image generation models
- **Categories**: Maternity photos (mansak_img), family photos (family_img), stickers (sticker_img)
- **Processing Pipeline**: Generation → WebP conversion → thumbnail creation → GCS storage
- **Optimization**: Base64 migration to file-based storage for performance

### Content Management
- **Dynamic Categories**: Configurable concept categories with ordering
- **Banner System**: Slide banners and small banners with upload capabilities
- **Music Styles**: Predefined styles with prompt templates for consistency
- **Milestone System**: Interactive achievements with campaign periods

## External Dependencies

### Third-party APIs
- **TopMediai API**: Primary music generation service with task-based polling
- **OpenAI GPT**: Fallback lyric generation and content enhancement
- **Google Gemini**: Alternative AI processing capabilities

### Cloud Services
- **Google Cloud Storage**: Production file storage with automatic cleanup
- **Firebase Admin SDK**: Service account management and additional GCS features

### Development Tools
- **Drizzle Kit**: Database migration management
- **Sharp**: High-performance image processing for thumbnails
- **JWT**: Token-based authentication system
- **bcrypt**: Password hashing for security

### Infrastructure
- **Environment Variables**: Comprehensive configuration for API keys, database connections, and service credentials
- **Rate Limiting**: API endpoint protection against abuse
- **CORS Configuration**: Cross-origin request handling for development and production
- **Error Handling**: Centralized error management with logging