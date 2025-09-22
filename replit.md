# Overview

This is an AI-powered hospital culture center application that provides music generation, image creation, and milestone tracking services for maternity hospitals. The platform includes both user-facing features and administrative tools for hospital management.

The application serves multiple user types including patients, hospital staff, and system administrators with features like AI music generation using TopMediai, image creation with various AI models, interactive milestones, and comprehensive administrative dashboards.

# User Preferences

Preferred communication style: Simple, everyday language.

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