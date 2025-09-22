# AI 우리병원 문화센터 플랫폼

## Overview
This project is an AI-powered cultural center platform for hospitals, featuring a music generation system using the TopMediai engine and dual AI image generation models (OpenAI DALL-E 3 & Google Gemini 2.5 Flash). Its core capabilities include high-quality music generation via the TopMediai API, gender and music style selection, real-time music streaming, Google Cloud Storage-based file management, and a robust JWT + Firebase authentication system. The platform aims to provide a unique and engaging experience for hospital cultural centers, leveraging AI for creative content.

## User Preferences
- 모든 개발과 커뮤니케이션은 한국어로만 진행
- 기존 파일 수정을 통한 기능 추가 우선 (새 파일 생성 최소화)
- 실제 사용자 데이터만 사용 (목업 데이터 금지)
- **팩트체크 필수**: 모든 추론 및 검증이 필요한 답변은 반드시 팩트체크 후 제공
- **팩트체크 미완료 시 고지**: 팩트체크가 되지 않은 정보는 "팩트체크가 필요함"을 명시
- `uploads/` 및 `static/uploads/` 폴더 절대 수정 금지 (사용자가 명시적으로 "수정해" 라고 지시하기 전까지 절대 건드리지 않음)
- **🚨 필수 규칙**: 모든 생성 파일(이미지, 음악, 콜라주, 문서 등)은 반드시 Google Cloud Storage (GCS)에 저장 - 로컬 파일 시스템 저장 절대 금지 (2025-09-01 지정)

## System Architecture

### UI/UX Decisions
The platform features a modern, mobile-friendly design with a focus on intuitive user experience.
- PWA installation prompts are unified across platforms with consistent messaging.
- Mobile UX improvements include scroll-to-top on page navigation and intuitive back button behavior in modals.
- PWA icons leverage a new AI logo for a modern look, supporting various sizes and formats (PNG).
- Login and authentication pages are integrated and streamlined.
- Consistent design language uses purple and indigo gradients for hospital branding, with clear button color schemes.
- Image galleries display all user-generated images with consistently placed download/delete buttons for touch and large screens.
- Fullscreen main slide banners provide an impactful visual experience, especially on mobile, with dynamic slide times and transition effects (Fade, Slide, Zoom, Cube, Flip).

### Technical Implementations
- **🚨 파일 저장 정책 (필수)**: 
    - **모든 생성 파일은 반드시 Google Cloud Storage (GCS)에 저장**
    - 로컬 파일 시스템(`/static/`, `/uploads/` 등) 사용 절대 금지
    - Replit 환경에서 로컬 파일은 재배포 시 소실됨 (휘발성)
    - GCS 저장 경로 구조: `createtree-upload` 버킷 사용
    - 적용 대상: 이미지, 음악, 콜라주, 문서, 썸네일 등 모든 생성 파일
    - **⚠️ GCS 업로드 시 주의사항 (2025-09-01 지정)**:
        - **버킷 존재 확인 (`ensureBucketExists()`) 사용 금지** - Firebase 서비스 계정 권한 문제로 403 오류 발생
        - `file.save()` 메서드 직접 사용 (버킷 확인 없이)
        - `makePublic()` 실패 시에도 URL 반환 처리 (버킷이 이미 공개일 수 있음)
- **Music Generation**: Supports instrumental-only options and robust progress tracking with real-time UI updates and toast notifications upon completion.
- **Authentication & Authorization**: Implemented JWT + Firebase for secure user authentication. Features include password/ID recovery via Gmail API, username duplication checks, and auto-login after registration. A centralized permission system (FREE, PRO, MEMBERSHIP, ADMIN, SUPERADMIN) controls access to premium features, dynamically linked to hospital activation status.
- **Content Management**:
    - **Music Styles**: Managed via a database, allowing real-time updates from the admin panel to user interfaces.
    - **Image Generation**: Dual AI model support with user selection:
        - **OpenAI DALL-E 3**: High-quality, accurate transformations with GPT-4o prompt engineering
        - **Google Gemini 2.5 Flash Image Preview**: Fast, cost-effective image transformations
        - Images are stored on GCS with automatic thumbnail generation
        - **Model-specific GCS upload strategies (2025-09-12 해결)**:
            - **Gemini**: 로컬 파일 경로 반환 → 직접 파일 읽기 → `saveImageToGCS` 사용
            - **OpenAI**: 원격 URL 반환 → URL 다운로드 → `saveImageFromUrlToGCS` 사용
            - 이전 "Invalid URL" 오류 완전 해결 (제미나이 로컬 경로를 URL로 fetch 시도하던 문제)
    - **Banner System**: Features a robust CRUD system for slide and small banners, with permanent storage on `static/banner/` folders, ensuring persistence across server restarts. Includes automatic file cleanup on modification or deletion.
- **Admin Features**:
    - **Concept Reordering**: Admin can reorder concepts by category with drag-and-drop or arrow buttons, reflecting changes instantly in the database.
    - **User Management**: Comprehensive filtering by search, member type, and hospital.
    - **Hospital Membership QR System**: Manages hospital codes (master, limited, qr_unlimited, qr_limited) for member registration, including QR generation, scanning, and automatic form completion.
    - **Milestone Management**: Supports both informational and participatory milestones with a complete CRUD system, notification services, and administrator approval workflows.
- **Performance & Stability**:
    - **Music Engine Optimization**: Achieves 50% faster music generation (1-2 minutes) through prompt pre-processing, HTTP connection pooling, and dynamic polling intervals.
    - **JWT Optimization**: Caching mechanisms reduce authentication response times significantly.
    - **PWA Performance**: Optimized loading times and user experience with splash screens, caching, and service worker improvements.
    - **GCS Integration**: Robust file management with direct public URLs for images, optimized URL conversion, and scalable folder structures for users. Model-specific upload pipelines ensure reliability across different AI backends.
    - **API Rate Limiting**: Implemented to ensure system stability.

### Feature Specifications
- High-quality music generation with TopMediai API.
- Gender and music style selection for music generation.
- Real-time music streaming.
- JWT + Firebase authentication with detailed user roles and permissions.
- Image generation with advanced AI models.
- Comprehensive admin panel for content, user, and hospital management.
- Progressive Web App (PWA) with offline capabilities and push notifications.
- Integrated notification system for user activities and milestone progress.

### System Design Choices
- **Microservices-oriented approach** for key functionalities (e.g., music engine, image generation).
- **Database-driven configurations** for dynamic content (music styles, banners, milestones) instead of hardcoding.
- **Stateless API design** for scalability.
- **Asynchronous processing** for long-running tasks like music generation, providing real-time feedback.
- **Robust error handling and logging** across all layers.
- **Permanent storage solutions** for user-generated content and media assets to prevent data loss.

## External Dependencies

- **TopMediai API**: Main engine for music generation.
- **Google Cloud Storage (GCS)**: Primary storage for generated music files and images.
- **Firebase**: Used for user authentication and potentially other backend services.
- **Gmail API**: Utilized for sending password reset emails.
- **Drizzle ORM**: PostgreSQL database management.
- **OpenAI API (DALL-E 3, GPT-4o)**: Used for AI image generation and prompt engineering.
- **Google Gemini API (2.5 Flash Image Preview)**: Alternative AI model for fast and cost-effective image transformations.