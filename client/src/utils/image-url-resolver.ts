/**
 * 이미지 URL 해결 유틸리티
 * 
 * 문제: 로컬 /uploads/ 경로로 저장된 이미지가 개발환경에서 접근 불가
 * 해결: 환경에 따라 GCS URL로 동적 변환하거나 적절한 경로로 매핑
 */

// GCS 버킷 정보 (server/utils/gcs-image-storage.ts와 동일)
const GCS_BUCKET_NAME = 'createtree-upload';
const GCS_BASE_URL = `https://storage.googleapis.com/${GCS_BUCKET_NAME}`;

/**
 * 로컬 /uploads/ 경로를 GCS URL로 변환
 * @param localPath 로컬 파일 경로 (예: "/uploads/2024/12/image.jpg")
 * @returns GCS 공개 URL
 */
function convertLocalPathToGCS(localPath: string): string {
  // "/uploads/" 제거하고 GCS 경로로 변환
  const relativePath = localPath.replace(/^\/uploads\//, '');
  const gcsUrl = `${GCS_BASE_URL}/${relativePath}`;
  console.log(`🌐 [convertLocalPathToGCS] ${localPath} → ${gcsUrl}`);
  return gcsUrl;
}

/**
 * GCS Signed URL에서 파일 경로 추출
 * @param gcsUrl GCS signed URL
 * @returns 파일 경로 (예: "uploads/24/filename.jpg")
 */
function extractGCSFilePath(gcsUrl: string): string | null {
  try {
    const url = new URL(gcsUrl);
    // https://storage.googleapis.com/bucket-name/path/to/file.jpg?signed_params...
    const pathParts = url.pathname.split('/');
    if (pathParts.length >= 3) {
      // Remove empty string and bucket name, keep the rest
      return pathParts.slice(2).join('/');
    }
    return null;
  } catch (error) {
    console.warn('🔍 [extractGCSFilePath] URL 파싱 실패:', error);
    return null;
  }
}

/**
 * 새로운 GCS Signed URL 생성 요청
 * @param filePath 파일 경로 (예: "uploads/24/filename.jpg")
 * @returns Promise<string | null> 새로운 signed URL 또는 null
 */
async function requestNewSignedUrl(filePath: string): Promise<string | null> {
  try {
    console.log('🔄 [requestNewSignedUrl] 새 signed URL 요청:', filePath);

    // JWT 토큰 가져오기 (httpOnly 쿠키는 credentials: 'include'로 자동 전송)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const jwtToken = localStorage.getItem('auth_token');
    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    const response = await fetch(`/api/secure-image/signed-url/${encodeURIComponent(filePath)}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      console.warn('⚠️ [requestNewSignedUrl] API 요청 실패:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    if (data.success && data.url) {
      console.log('✅ [requestNewSignedUrl] 새 signed URL 생성 성공');
      return data.url;
    }

    console.warn('⚠️ [requestNewSignedUrl] API 응답에 URL 없음:', data);
    return null;
  } catch (error) {
    console.error('❌ [requestNewSignedUrl] 요청 실패:', error);
    return null;
  }
}

/**
 * 이미지 URL이 유효한지 확인 (로딩 테스트)
 * @param url 테스트할 이미지 URL
 * @returns Promise<boolean> 이미지 로딩 가능 여부
 */
function testImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;

    // 5초 타임아웃
    setTimeout(() => resolve(false), 5000);
  });
}

/**
 * 기본 이미지 URL 반환
 * @param type 이미지 타입 ("thumbnail" | "reference" | "general")
 * @returns 기본 이미지 URL
 */
function getDefaultImageUrl(type: "thumbnail" | "reference" | "general" = "general"): string {
  // 기본 플레이스홀더 이미지 (lucide-react 아이콘 스타일 SVG)
  const defaultImages = {
    thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120' viewBox='0 0 200 120'%3E%3Crect width='200' height='120' fill='%23f1f5f9'/%3E%3Cpath d='M60 45h80v30H60z' fill='%23cbd5e1'/%3E%3Ccircle cx='80' cy='55' r='5' fill='%23e2e8f0'/%3E%3Cpath d='M110 65l10-10 20 20v10H90v-5z' fill='%23e2e8f0'/%3E%3C/svg%3E",
    reference: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23f8fafc'/%3E%3Cpath d='M30 30h60v60H30z' fill='%23e2e8f0'/%3E%3Ccircle cx='50' cy='50' r='8' fill='%23cbd5e1'/%3E%3Cpath d='M65 65l10-10 15 15v10H50v-8z' fill='%23cbd5e1'/%3E%3C/svg%3E",
    general: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23f1f5f9'/%3E%3Cpath d='M40 50h70v50H40z' fill='%23cbd5e1'/%3E%3Ccircle cx='65' cy='70' r='6' fill='%23e2e8f0'/%3E%3Cpath d='M80 85l12-12 18 18v9H60v-6z' fill='%23e2e8f0'/%3E%3C/svg%3E"
  };

  return defaultImages[type] || defaultImages.general;
}

/**
 * 메인 이미지 URL 해결 함수
 * 
 * @param imageUrl 원본 이미지 URL (DB에 저장된 값)
 * @param type 이미지 타입 ("thumbnail" | "reference" | "general")
 * @param useCache 캐시 사용 여부 (기본값: true)
 * @returns 해결된 이미지 URL
 */
export async function resolveImageUrl(
  imageUrl: string | null | undefined,
  type: "thumbnail" | "reference" | "general" = "general",
  useCache: boolean = true
): Promise<string> {
  // 1. null/undefined/empty 처리
  if (!imageUrl || imageUrl.trim() === '') {
    return getDefaultImageUrl(type);
  }

  // 2. 이미 완전한 URL인 경우 (http/https로 시작)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // 캐시 사용하지 않는 경우 즉시 반환
    if (!useCache) {
      return imageUrl;
    }

    // URL 유효성 검증
    const isValid = await testImageUrl(imageUrl);
    return isValid ? imageUrl : getDefaultImageUrl(type);
  }

  // 3. 로컬 /uploads/ 경로 처리
  if (imageUrl.startsWith('/uploads/')) {
    // 개발 환경에서는 GCS로 변환 시도
    if (import.meta.env.DEV) {
      const gcsUrl = convertLocalPathToGCS(imageUrl);

      // 캐시 사용하지 않는 경우 즉시 GCS URL 반환
      if (!useCache) {
        return gcsUrl;
      }

      // GCS URL 유효성 검증
      const isGcsValid = await testImageUrl(gcsUrl);
      if (isGcsValid) {
        return gcsUrl;
      }

      // GCS에서도 실패하면 로컬 경로 시도 (혹시 로컬에서 서빙되는 경우)
      const isLocalValid = await testImageUrl(imageUrl);
      return isLocalValid ? imageUrl : getDefaultImageUrl(type);
    }

    // 프로덕션 환경에서는 로컬 경로 그대로 사용 (서버에서 정적 파일 서빙 가정)
    else {
      // 캐시 사용하지 않는 경우 즉시 반환
      if (!useCache) {
        return imageUrl;
      }

      const isValid = await testImageUrl(imageUrl);
      return isValid ? imageUrl : getDefaultImageUrl(type);
    }
  }

  // 4. 상대 경로 처리 (uploads/로 시작하는 경우)
  if (imageUrl.startsWith('uploads/')) {
    return resolveImageUrl('/' + imageUrl, type, useCache);
  }

  // 5. 기타 경우 기본 이미지 반환
  console.warn('알 수 없는 이미지 URL 형식:', imageUrl);
  return getDefaultImageUrl(type);
}

/**
 * 동기적 이미지 URL 해결 함수 (캐시 검증 없음)
 * 즉시 변환된 URL을 반환하며, 이미지 로딩 실패 시 onError 핸들러에서 처리
 * 
 * @param imageUrl 원본 이미지 URL
 * @param type 이미지 타입
 * @returns 변환된 이미지 URL (검증 없음)
 */
export function resolveImageUrlSync(
  imageUrl: string | null | undefined,
  type: "thumbnail" | "reference" | "general" = "general"
): string {
  console.log(`🖼️ [resolveImageUrlSync] 원본 URL: "${imageUrl}", 타입: ${type}, 개발환경: ${import.meta.env.DEV}`);

  // 1. null/undefined/empty 처리
  if (!imageUrl || imageUrl.trim() === '') {
    console.log('🖼️ [resolveImageUrlSync] 빈 URL, 기본 이미지 반환');
    return getDefaultImageUrl(type);
  }

  // 2. 이미 완전한 URL인 경우
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    console.log('🖼️ [resolveImageUrlSync] 완전한 URL, 그대로 반환:', imageUrl);
    return imageUrl;
  }

  // 3. 로컬 /uploads/ 경로 처리
  if (imageUrl.startsWith('/uploads/')) {
    // 개발 환경에서는 GCS로 변환
    if (import.meta.env.DEV) {
      const gcsUrl = convertLocalPathToGCS(imageUrl);
      console.log(`🖼️ [resolveImageUrlSync] 개발환경: ${imageUrl} → ${gcsUrl}`);
      return gcsUrl;
    }
    // 프로덕션 환경에서는 그대로 사용
    else {
      console.log('🖼️ [resolveImageUrlSync] 프로덕션환경, 로컬 경로 유지:', imageUrl);
      return imageUrl;
    }
  }

  // 4. 상대 경로 처리
  if (imageUrl.startsWith('uploads/')) {
    console.log('🖼️ [resolveImageUrlSync] 상대 경로 → 절대 경로 변환');
    return resolveImageUrlSync('/' + imageUrl, type);
  }

  // 5. 기타 경우 기본 이미지 반환
  console.warn('🖼️ [resolveImageUrlSync] 알 수 없는 이미지 URL 형식:', imageUrl);
  return getDefaultImageUrl(type);
}

/**
 * 이미지 컴포넌트에서 사용할 수 있는 onError 핸들러 (GCS Signed URL 갱신 포함)
 * @param type 이미지 타입
 * @returns onError 이벤트 핸들러
 */
export function createImageErrorHandler(type: "thumbnail" | "reference" | "general" = "general") {
  return async (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = event.target as HTMLImageElement;
    const failedUrl = target.src;

    // 이미 기본 이미지인 경우 더 이상 처리하지 않음
    if (failedUrl === getDefaultImageUrl(type)) {
      return;
    }

    console.warn(`🚨 [createImageErrorHandler] 이미지 로딩 실패: ${failedUrl}`);

    // GCS signed URL 만료 시 새 URL로 갱신 시도
    if (failedUrl.includes('storage.googleapis.com') && failedUrl.includes('X-Goog-Algorithm')) {
      console.log('🔄 [createImageErrorHandler] GCS signed URL 만료 감지, 새 URL 요청...');

      const filePath = extractGCSFilePath(failedUrl);
      if (filePath) {
        const newUrl = await requestNewSignedUrl(filePath);
        if (newUrl) {
          console.log('✅ [createImageErrorHandler] 새 signed URL로 교체:', newUrl);
          target.src = newUrl;
          return;
        }
      }
    }

    // 새 URL 생성 실패 시 기본 이미지로 대체
    console.warn(`🔄 [createImageErrorHandler] 기본 이미지로 대체: ${failedUrl}`);
    target.src = getDefaultImageUrl(type);
  };
}

/**
 * React 컴포넌트에서 사용할 수 있는 이미지 URL 훅 (선택적)
 * @param imageUrl 원본 이미지 URL
 * @param type 이미지 타입
 * @returns [resolvedUrl, isLoading, error]
 */
export function useImageUrl(
  imageUrl: string | null | undefined,
  type: "thumbnail" | "reference" | "general" = "general"
): [string, boolean, string | null] {
  const [resolvedUrl, setResolvedUrl] = React.useState<string>(getDefaultImageUrl(type));
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const resolveUrl = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const resolved = await resolveImageUrl(imageUrl, type);

        if (isMounted) {
          setResolvedUrl(resolved);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('이미지 URL 해결 실패:', err);
          setError(err instanceof Error ? err.message : '알 수 없는 오류');
          setResolvedUrl(getDefaultImageUrl(type));
          setIsLoading(false);
        }
      }
    };

    resolveUrl();

    return () => {
      isMounted = false;
    };
  }, [imageUrl, type]);

  return [resolvedUrl, isLoading, error];
}

// React import (훅 사용 시 필요)
import React from 'react';