# Overview

This project is an AI-powered hospital culture center application designed for maternity hospitals. It offers music generation, image creation, snapshot generation, and milestone tracking services. The platform serves patients, hospital staff, and system administrators, aiming to enhance the hospital experience and streamline administrative tasks. Key capabilities include AI music generation via TopMediai, AI-driven image creation, AI snapshot generation with randomized prompts, interactive milestone tracking, and comprehensive administrative dashboards.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## October 29, 2025 - CRITICAL: Data Loss Incident & Recovery Guide 🚨
**Status**: Production safety measures implemented

### Incident Summary
- **Time**: 2025-10-29 06:06 AM
- **Cause**: Accidental execution of `npm run db:seed` in production environment
- **Impact**: 
  - `images` table: Thousands of records → 1 record remaining
  - `music` table: All records deleted
  - `snapshot_generation_images` table: All records deleted
  - ✅ **GCS files**: Safe (no physical file deletion)

### Root Cause
The `db/seed.ts` script contained destructive `DELETE` operations without production safeguards:
```typescript
await db.delete(schema.images);  // ❌ Deleted all image records
await db.delete(schema.music);   // ❌ Deleted all music records
```

### Protection Measures Implemented
1. **Environment Guards**: 
   - NODE_ENV check (blocks production)
   - REPL_SLUG check (detects production indicators)
   - DATABASE_URL validation (checks for "prod" in connection string)

2. **Force Flag Requirement**: 
   - Must set `FORCE_SEED=true` to proceed
   - Prevents accidental execution

3. **Comprehensive Warnings**:
   - ASCII art alerts for destructive operations
   - Detailed logging of what will be deleted
   - Environment information display

### Recovery Options
1. **Replit Checkpoint Rollback** (Recommended):
   - Navigate to Replit checkpoints
   - Select checkpoint before 2025-10-29 06:06 AM
   - **MUST CHECK "Restore databases" option**
   - Note: All code changes after checkpoint will be lost

2. **Manual Reconstruction** (Partial):
   - GCS files remain intact
   - Database records must be recreated manually
   - Metadata may be lost (userId, categoryId, etc.)

### Safe Seeding Commands
```bash
# Safe (with all guards)
FORCE_SEED=true NODE_ENV=development npm run db:seed

# DO NOT USE in production
npm run db:seed
```

### Documentation Created
- `SNAPSHOT_DEVELOPMENT_GUIDE.md`: Complete re-implementation guide
- Includes all code, patterns, and safety measures
- Step-by-step checklist for rollback recovery

### Lessons Learned
1. ✅ Never run seed scripts in production
2. ✅ Always implement environment checks for destructive operations
3. ✅ Require explicit confirmation flags
4. ✅ Log all destructive operations
5. ✅ Maintain comprehensive documentation for disaster recovery

## October 29, 2025 - AI Snapshot Generator Complete Integration ✅
**Status**: Production-ready with zero-error validation (Pre-incident)

### Phase 0: Environment Validation
- ✅ Gemini API key confirmed and functional
- ✅ GCS configured via Firebase Admin SDK
- ✅ Upload infrastructure verified

### Phase 1: Database & Services (Architect Reviewed)
- **Database Schema**:
  - `snapshot_generations`: user generations with mode, style, status tracking
  - `snapshot_generation_images`: 5 images per generation with unique constraints
  - Performance indexes on (user_id, created_at) and status
  - ON DELETE SET NULL policy for prompt references (preserves history)
- **Weighted Prompt Selection Service**:
  - Algorithm: weight = 1 / (usageCount + 1)
  - Transaction-safe with row locking (FOR UPDATE)
  - Fallback mechanism for gender-specific prompts
  - Custom error classes with Zod validation

### Phase 2: API Implementation (Security Hardened)
- **Generation API** (POST /api/snapshot/generate):
  - Multi-file upload (1-4 images, max 10MB each)
  - Gemini 2.5 Flash integration with exponential backoff retry
  - GCS storage with privacy protection:
    * User reference photos: PRIVATE (no public exposure)
    * Generated results: PUBLIC (for sharing)
  - Database transaction management for atomic updates
- **History API** (GET /api/snapshot/history):
  - Pagination with page/limit parameters
  - Status filtering (pending/completed/failed)
  - User-scoped data (prevents cross-user leakage)

### Phase 3: Frontend UI (Responsive Design)
- **Main Snapshot Page** (/snapshot):
  - Multi-file upload with preview and validation
  - Mode selection: Individual, Couple, Family
  - Style selection: Mix, Daily, Travel, Film
  - Optional gender selection
  - Real-time form validation (react-hook-form + Zod)
  - Results gallery with 5 generated images
  - Download functionality
- **History Page** (/snapshot/history):
  - Paginated history with status badges
  - Filter by status with auto-reset pagination
  - Image viewer dialog with navigation
  - Empty states and error handling
- **Navigation**: Integrated into sidebar and routes with Camera icon

### Critical Security Fixes Applied
1. User-uploaded reference photos remain PRIVATE (removed makePublic())
2. History API prevents cross-user data leakage (userId filter always applied)

### Admin System (Pre-existing)
- Complete CRUD interface for managing snapshot prompts
- 6 API endpoints: list, create, update, delete, toggle, stats
- Admin UI at `/admin` > "이미지 생성" > "스냅사진 프롬프트"
- 100 family prompts seeded (Daily: 35, Travel: 30, Film: 35)
- Usage tracking and statistics dashboard

### Architecture Highlights
- **Zero-error development**: All phases Architect-reviewed and validated
- **Modular design**: Separate routes (`server/routes/snapshot.ts`, `server/routes/admin-snapshot.ts`)
- **Services layer**: `snapshotPromptService.ts`, `geminiSnapshotService.ts`
- **Frontend constants**: `client/src/constants/snapshot.ts`
- **LSP errors**: 0 across entire integration
- **Design Philosophy**: Random prompt selection for engagement

# Development Notes

## Test Accounts (Development Only)
⚠️ **For development and testing purposes only**

- **Admin Account**: 9059056@gmail.com / 123456

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
- **Modular Structure**: 18 separated router modules for core functionalities (e.g., auth, milestone, admin, image, admin-snapshot, snapshot).

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

### Snapshot Generation System (New - October 2025)
- **Engine**: Gemini 2.5 Flash
- **Features**: Random prompt selection, 5 images per generation, 1-4 user photo uploads
- **Modes**: Individual, Couple, Family
- **Style Categories**: Mix, Daily, Travel, Film
- **Database-driven Prompts**: 100+ prompts stored in PostgreSQL with admin management interface
- **Extensibility**: Ready for future filters (region, season, country selection for travel style)

### Content Management
- **Dynamic Categories**: Configurable concept categories
- **Banner System**: Slide and small banners
- **Music Styles**: Predefined styles with prompt templates
- **Snapshot Prompts**: Database-driven prompt system with CRUD admin interface
  - 100 family prompts seeded (Daily: 35, Travel: 30, Film: 35)
  - Admin management at `/admin` > "이미지 생성" > "스냅사진 프롬프트"
  - Filtering by category, type, gender, region, season
  - Usage tracking and statistics dashboard
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