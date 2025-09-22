# 배너 이미지 저장소 (업데이트됨)

⚠️ **이 폴더는 더 이상 사용되지 않습니다**

## 새로운 배너 저장 구조 (2025-06-25)
- **슬라이드 배너**: `/static/banner/slide-banners/`
- **작은 배너**: `/static/banner/small-banners/`

## 변경 이유
- 통합된 배너 관리 시스템
- 더 명확한 폴더 구조
- 영구 저장소 보장

## 파일 명명 규칙
- 업로드 시 자동 생성: `banner-{timestamp}-{random}.{ext}`
- 예시: `banner-1750776508409-569909315.webp`

## 새로운 접근 URL
- 슬라이드 배너: `/static/banner/slide-banners/{filename}`
- 작은 배너: `/static/banner/small-banners/{filename}`

## 관리 방법
1. 관리자 페이지에서 배너 이미지 업로드
2. API 엔드포인트: `/api/admin/upload/banner`
3. 업로드된 파일은 새로운 구조에 영구 저장됨