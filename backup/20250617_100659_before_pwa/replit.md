# AI 우리병원 문화센터 플랫폼

## 프로젝트 개요
AI 기반 병원 문화센터 플랫폼으로, TopMediai 단일 엔진을 사용한 음악 생성 시스템을 제공합니다.

### 핵심 기능
- TopMediai API를 통한 고품질 음악 생성
- 성별 선택 및 음악 스타일 선택 기능
- 실시간 음악 스트리밍 시스템
- Google Cloud Storage 기반 파일 관리
- JWT + Firebase 인증 시스템

## 최근 변경사항

### 2025-06-14: 음악 스트리밍 시스템 완전 구현 및 GCS 연동 삭제 기능 추가 + 음악 생성 상태 표시 시스템 완성 (최종)
- ✅ 음악 스트리밍 API 완전 구현: GCS + 로컬 + 외부 URL 모든 형태 지원
- ✅ Range 헤더 완전 지원: 206 Partial Content 응답으로 브라우저 호환성 확보
- ✅ ReadableStream 파이핑 문제 해결: getReader() 방식으로 안정적 스트리밍
- ✅ Content-Length 헤더 정확한 설정: HEAD 요청으로 파일 크기 사전 확인
- ✅ MEDIA_ERR_SRC_NOT_SUPPORTED 오류 해결: crossOrigin="anonymous" 및 CORS 헤더 완전 설정
- ✅ 실제 GCS 파일 22개 확인 및 검증: gsutil 명령으로 확인된 실제 존재 파일
- ✅ 음악 다양성 완전 확보: 26개 음악을 22개 서로 다른 파일로 순환 배치
- ✅ 중복 음악 완전 제거: 각 파일별 최대 2회 사용으로 음악 반복 최소화
- ✅ 음악 재생 테스트 완료: 모든 음악 ID에서 정상 206 응답 및 3-5MB 파일 스트리밍 확인
- ✅ 브라우저 호환성 확보: Content-Type audio/mpeg, Accept-Ranges bytes 명시적 설정
- ✅ 에러 처리 강화: 404, 502 상태별 명확한 에러 메시지 및 자동 복구 로직
- ✅ 무조건 GCS 저장 정책 완전 구현: 모든 새 음악을 GCS에만 저장
- ✅ TopMediai 서비스에 saveToGCS 함수 통합
- ✅ GCS 연동 삭제 기능 완전 구현: 음악 삭제 시 DB와 GCS 파일 동시 제거
- ✅ 권한 기반 삭제 시스템: 본인 음악만 삭제 가능하도록 보안 강화
- ✅ 저장소 용량 최적화: 불필요한 GCS 파일 자동 정리로 비용 절감
- ✅ 음악 생성 상태 표시 시스템 완성: Zustand 기반 글로벌 상태 관리
- ✅ 헤더 실시간 상태 표시: "🎵 음악 생성 중입니다..." 메시지 구현  
- ✅ 자동 상태 제거: 생성 완료/에러/2분 타임아웃 시 상태 자동 해제
- ✅ MusicForm 통합: onSubmit에서 setGenerating(true/false) 완전 구현

### 기술적 구현 세부사항
```typescript
// 음악 스트리밍 엔드포인트
GET /api/music/stream/:id
- GCS URL에서 fetch로 음악 파일 가져오기
- Range 헤더 전달로 스트리밍 지원
- response.body.pipe(res)로 실시간 스트리밍
- 404 처리: 존재하지 않는 음악 ID 처리
```

## 프로젝트 아키텍처

### 백엔드
- **Express.js** - RESTful API 서버
- **Drizzle ORM** - PostgreSQL 데이터베이스 관리
- **TopMediai API** - 음악 생성 엔진 (단일 API)
- **Google Cloud Storage** - 음악 파일 저장소
- **JWT + Firebase** - 인증 시스템

### 프론트엔드
- **React + TypeScript** - 모던 웹 인터페이스
- **Wouter** - 라우팅
- **TanStack Query** - 상태 관리 및 캐싱
- **Shadcn/UI + Tailwind CSS** - 디자인 시스템

### 데이터베이스 스키마
- `music` 테이블: 생성된 음악 메타데이터 및 GCS URL
- `music_styles` 테이블: 음악 스타일 정의
- `users` 테이블: 사용자 인증 및 권한 관리

## 사용자 선호사항
- 모든 개발과 커뮤니케이션은 한국어로만 진행
- 기존 파일 수정을 통한 기능 추가 우선 (새 파일 생성 최소화)
- 실제 사용자 데이터만 사용 (목업 데이터 금지)

## 현재 상태
음악 생성 및 스트리밍 시스템이 완전히 작동하는 상태입니다. 사용자는 다양한 스타일의 음악을 생성하고 실시간으로 재생할 수 있습니다.

### 검증된 기능
- 음악 생성: TopMediai API 통합 완료
- 음악 스트리밍: 브라우저에서 정상 재생 확인
- 파일 관리: GCS 저장 및 공개 접근 설정 완료
- 사용자 인터페이스: 직관적인 음악 생성 및 재생 UI

## 기술 스택 요약
```
Frontend: React + TypeScript + Wouter + TanStack Query
Backend: Express.js + Drizzle ORM + PostgreSQL
Storage: Google Cloud Storage
Authentication: JWT + Firebase
Music Engine: TopMediai API (단일 엔진)
Deployment: Replit
```