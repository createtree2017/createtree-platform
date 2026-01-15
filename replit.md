# Overview

This project is an AI-powered hospital culture center application specifically designed for maternity hospitals. It integrates AI for music generation, image creation, and provides interactive milestone tracking. The platform aims to enhance the hospital experience for patients, support staff, and streamline administrative tasks. Key capabilities include AI music generation, AI-driven image creation with face preservation, interactive milestone tracking, and comprehensive administrative dashboards. The application focuses on providing a personalized and engaging experience for new and expecting parents.

# User Preferences

Preferred communication style: Simple, everyday language.

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
- **AI Providers**: Multiple models supported, including Google Vertex AI Imagen for upscaling.
- **Categories**: Maternity photos, family photos, stickers.
- **Processing Pipeline**: Generation, WebP conversion, thumbnail creation, GCS storage. Supports image-to-image transformations and background removal using BiRefNet-portrait-ONNX.
- **Image Upload System**: Dual-resolution storage in GCS (original and preview) for efficient editing and high-quality export.

### Content Management
- **Dynamic Categories**: Configurable concept categories.
- **Banner System**: Slide and small banners.
- **Music Styles**: Predefined styles with prompt templates.
- **Mission System**: Starbucks Frequency-inspired mission system with theme mission CRUD, sub-mission builder, and review dashboard. Supports hospital-specific scoping and various submission types.

### Unified Export System
- Centralized, database-driven export architecture for all product categories.
- Supports dynamic quality options, bleed area, orientation handling, and multi-page PDF export.

# External Dependencies

## Third-party APIs
- **TopMediai API**: Music generation.
- **OpenAI GPT**: Fallback lyric generation and content enhancement.
- **Google Gemini**: AI processing.
- **Google Vertex AI Imagen API**: Image upscaling.
- **HuggingFace (BiRefNet-portrait-ONNX)**: Background removal.

## Cloud Services
- **Google Cloud Storage (GCS)**: Production file storage.
- **Firebase Admin SDK**: Service account management and GCS features.

## Development Tools
- **Drizzle Kit**: Database migration management.
- **Sharp**: Image processing.
- **JWT**: Token-based authentication.
- **bcrypt**: Password hashing.