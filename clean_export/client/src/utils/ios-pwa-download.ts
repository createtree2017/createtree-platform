/**
 * iOS PWA 환경에서의 이미지 다운로드 처리
 * Web Share API를 활용한 안전한 이미지 저장 방식
 */

import { detectPlatform, isWebShareSupported, isWebShareFilesSupported } from './platform-detection';

export interface DownloadResult {
  success: boolean;
  method: 'webshare' | 'instruction' | 'standard' | 'fallback' | 'modal';
  message?: string;
  error?: string;
  needsModal?: boolean;
}

/**
 * 이미지 URL을 Blob으로 변환합니다
 */
async function urlToBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('URL to Blob conversion failed:', error);
    throw error;
  }
}

/**
 * Blob을 File 객체로 변환합니다
 */
function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now()
  });
}

/**
 * Web Share API를 사용하여 이미지를 공유/저장합니다 (same-origin 방식으로 CORS 해결)
 */
async function shareImageViaWebShare(downloadUrl: string, title: string, filename: string): Promise<DownloadResult> {
  try {
    console.log('🔄 Web Share API 시도 중:', { downloadUrl, title, filename });
    
    // Same-origin 서버 프록시를 통해 이미지를 Blob으로 변환 (CORS 문제 해결)
    const response = await fetch(downloadUrl, {
      credentials: 'include' // 인증 쿠키 포함
    });
    
    if (!response.ok) {
      throw new Error(`서버에서 이미지를 가져올 수 없습니다: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Blob 타입에 따라 올바른 파일 확장자 결정
    const contentType = blob.type || 'image/webp';
    let actualFilename = filename;
    
    if (contentType.includes('jpeg')) {
      actualFilename = filename.replace(/\.(webp|png)$/i, '.jpg');
    } else if (contentType.includes('png')) {
      actualFilename = filename.replace(/\.(webp|jpg|jpeg)$/i, '.png');
    } else if (contentType.includes('webp')) {
      actualFilename = filename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }
    
    console.log('📄 파일 정보:', { contentType, originalName: filename, actualName: actualFilename });
    
    const file = blobToFile(blob, actualFilename);

    // Web Share API로 파일 공유 가능한지 확인
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      throw new Error('이 파일 형식은 공유가 지원되지 않습니다');
    }

    console.log('📤 Web Share API 실행 중...');
    
    // Web Share API 실행
    await navigator.share({
      title: '이미지 저장',
      text: `${title} 이미지를 저장하세요`,
      files: [file]
    });

    return {
      success: true,
      method: 'webshare',
      message: '이미지가 성공적으로 저장되었습니다!'
    };

  } catch (error: any) {
    console.error('Web Share API failed:', error);
    
    // 사용자가 취소한 경우
    if (error.name === 'AbortError') {
      return {
        success: false,
        method: 'webshare',
        message: '저장이 취소되었습니다'
      };
    }

    // Web Share API 실패 시 상세 로그
    console.warn('Web Share API 실패 - 백업 방식으로 전환:', error.message);
    
    return {
      success: false,
      method: 'webshare',
      error: `공유 실패: ${error.message}`
    };
  }
}

/**
 * iOS PWA에서 이미지 다운로드 안내를 위한 모달 표시 신호를 반환합니다
 */
function showIOSPWAInstructions(imageUrl: string, title: string): DownloadResult {
  // 새 창으로 이동하지 않고 모달 표시를 위한 결과 반환
  return {
    success: true,
    method: 'modal',
    message: '앱 내에서 이미지를 길게 눌러 저장하세요',
    needsModal: true // 모달 표시 필요 플래그
  };
}

/**
 * 기존 방식으로 다운로드를 시도합니다 (일반 브라우저용)
 */
function standardDownload(downloadUrl: string, filename: string): DownloadResult {
  try {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return {
      success: true,
      method: 'standard',
      message: '다운로드가 시작되었습니다'
    };
  } catch (error: any) {
    return {
      success: false,
      method: 'standard',
      error: `다운로드 실패: ${error.message}`
    };
  }
}

/**
 * 메인 다운로드 함수 - 환경에 따라 적절한 방식을 선택합니다
 */
export async function downloadImageSafely(
  imageUrl: string,
  downloadUrl: string,
  title: string,
  filename?: string
): Promise<DownloadResult> {
  const platform = detectPlatform();
  const defaultFilename = filename || `${title.replace(/[^a-z0-9]/gi, '_')}.jpg`;
  
  // 디버깅 정보 로깅
  console.log('🔽 Download Request:', {
    platform,
    imageUrl: imageUrl.substring(0, 50) + '...',
    title,
    webShareSupported: isWebShareSupported(),
    webShareFilesSupported: isWebShareFilesSupported()
  });

  // iOS PWA 환경 - Web Share API 재시도 (same-origin 방식으로 CORS 해결)
  if (platform.isIOSPWA) {
    console.log('📱 iOS PWA detected - 개선된 Web Share API 시도');
    
    // Web Share API가 지원되는지 확인
    if (isWebShareFilesSupported()) {
      console.log('🔄 Web Share API 지원 확인됨 - same-origin 방식으로 시도');
      
      try {
        // Same-origin 서버 프록시를 통한 Web Share API 시도
        const result = await shareImageViaWebShare(downloadUrl, title, defaultFilename);
        
        if (result.success) {
          console.log('✅ Web Share API 성공!');
          return result;
        }
        
        console.log('⚠️ Web Share API 실패 - 백업 방식으로 전환');
      } catch (error) {
        console.warn('Web Share API 오류:', error);
      }
    }
    
    // Web Share API가 실패하거나 지원되지 않는 경우 백업 방식
    console.log('📋 백업 방식: 안내 메시지 표시');
    return showIOSPWAInstructions(imageUrl, title);
  }

  // 일반 브라우저 환경
  console.log('🖥️ Standard browser - using traditional download');
  return standardDownload(downloadUrl, defaultFilename);
}

/**
 * 다운로드 결과에 따른 사용자 알림 메시지를 생성합니다
 */
export function getDownloadToastMessage(result: DownloadResult) {
  if (result.success) {
    // iOS PWA에서는 저장 위치에 따른 정확한 안내
    const isIOSPWA = detectPlatform().isIOSPWA;
    let description = result.message || "이미지 저장이 진행되었습니다";
    
    if (isIOSPWA) {
      if (result.method === 'webshare') {
        // Web Share API 성공 시 사진 앱 안내
        description = "이미지가 사진 앱에 저장되었습니다!";
      } else {
        // 백업 방식 시 다운로드 폴더 안내
        description = "다운로드가 완료되었습니다. 파일 앱 > 다운로드 폴더에서 확인하세요.";
      }
    }
      
    return {
      title: isIOSPWA ? "저장 완료" : "다운로드 진행",
      description,
      variant: "default" as const
    };
  } else {
    return {
      title: "저장 실패",
      description: result.error || "이미지 저장 중 오류가 발생했습니다",
      variant: "destructive" as const
    };
  }
}