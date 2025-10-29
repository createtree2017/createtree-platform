# Overview

This project is an AI-powered hospital culture center application designed for maternity hospitals. It offers music generation, image creation, snapshot generation, and milestone tracking services. The platform serves patients, hospital staff, and system administrators, aiming to enhance the hospital experience and streamline administrative tasks. Key capabilities include AI music generation via TopMediai, AI-driven image creation, AI snapshot generation with randomized prompts, interactive milestone tracking, and comprehensive administrative dashboards.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## October 29, 2025 - AI Snapshot Generator Integration
- **New Feature**: AI Snapshot Generator added as the 5th menu item in "창조AI V2" platform
- **Database**: New `snapshot_prompts` table with 100 seeded family prompts
- **Admin System**: Complete CRUD interface for managing snapshot prompts
  - 6 API endpoints: list, create, update, delete, toggle, stats
  - Admin UI integrated into existing admin panel under "이미지 생성" tab
  - Filtering, pagination, search, and statistics features
- **Architecture**: Fully modular design with zero hardcoding principle
  - Separate routes: `server/routes/admin-snapshot.ts`
  - Separate API namespace: `/api/admin/snapshot-prompts/*`
  - Future-ready for extensibility (region, season, country filters)
- **Design Philosophy**: Random prompt selection for engagement and fun factor

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
- **Modular Structure**: 17 separated router modules for core functionalities (e.g., auth, milestone, admin, image, admin-snapshot).

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