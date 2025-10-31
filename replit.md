# Overview

This project is an AI-powered hospital culture center application designed for maternity hospitals. It offers music generation, image creation, and milestone tracking services. The platform serves patients, hospital staff, and system administrators, aiming to enhance the hospital experience and streamline administrative tasks. Key capabilities include AI music generation via TopMediai, AI-driven image creation, interactive milestone tracking, comprehensive administrative dashboards, and AI Snapshot generation with face preservation.

## Recent Changes (2025-10-31)

### Snapshot Workflow Redesign
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
- Couple and family category prompts not yet created in database

# User Preferences

Preferred communication style: Simple, everyday language.

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