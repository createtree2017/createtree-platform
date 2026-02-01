import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 초 단위의 시간을 MM:SS 형식으로 변환
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환 (예: 1024 -> 1KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 날짜를 한국 시간대로 형식화
 */
export function formatDate(dateString: string, options: Intl.DateTimeFormatOptions = {}): string {
  try {
    const date = new Date(dateString);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    return new Intl.DateTimeFormat('ko-KR', { ...defaultOptions, ...options }).format(date);
  } catch (e) {
    console.error("날짜 변환 오류:", e);
    return dateString;
  }
}

/**
 * 텍스트를 지정된 길이로 잘라내고 말줄임표 추가
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  return text.slice(0, maxLength) + "...";
}

/**
 * HTML 정제 - 안전한 태그만 허용 (XSS 방지)
 * 허용 태그: b, strong, i, em, br, span (color 스타일만 허용), div, p
 * div/p 태그는 줄바꿈용으로 변환됨
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // 스크립트 태그와 이벤트 핸들러 제거 (먼저 처리)
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  result = result.replace(/on\w+\s*=/gi, '');
  result = result.replace(/javascript:/gi, '');

  // font 태그의 color 속성을 span style로 변환
  result = result.replace(/<font[^>]*color\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi, '<span style="color: $1">');
  result = result.replace(/<\/font>/gi, '</span>');

  // div와 p 닫는 태그를 br로 변환 (줄바꿈 유지)
  result = result.replace(/<\/div>/gi, '<br>');
  result = result.replace(/<\/p>/gi, '<br>');

  // 허용된 태그 정의
  const allowedTags = ['b', 'strong', 'i', 'em', 'br', 'span'];

  // 모든 태그를 치환하면서 허용된 것만 보존
  result = result.replace(/<(\/?)([\w]+)([^>]*)>/gi, (match, closing, tagName, attrs) => {
    const tag = tagName.toLowerCase();

    if (!allowedTags.includes(tag)) {
      return ''; // 허용되지 않은 태그 제거
    }

    // 닫는 태그는 그대로 반환
    if (closing === '/') {
      return `</${tag}>`;
    }

    // span 태그일 경우 color 스타일만 추출
    if (tag === 'span') {
      const colorMatch = attrs.match(/style\s*=\s*["'][^"']*color\s*:\s*([^;"']+)/i);
      if (colorMatch) {
        // 색상 값이 안전한지 확인 (hex, rgb, 색상 이름만 허용)
        const color = colorMatch[1].trim();
        const safeColorPattern = /^(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-zA-Z]+)$/;
        if (safeColorPattern.test(color)) {
          return `<span style="color: ${color}">`;
        }
      }
      return '<span>';
    }

    // br 태그 (self-closing)
    if (tag === 'br') {
      return '<br>';
    }

    // 다른 허용된 태그
    return `<${tag}>`;
  });

  // 연속된 br 태그 정리 (3개 이상을 2개로)
  result = result.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');

  return result;
}

/**
 * 이미지 캐시 무효화 헬퍼
 * URL에 타임스탬프 쿼리 파라미터를 추가하여 브라우저 캐시를 우회
 */
export function addCacheBuster(url: string | undefined | null): string {
  if (!url) return '';

  // 빈 문자열이면 그대로 반환
  if (url.trim() === '') return url;

  // 이미 쿼리 파라미터가 있는지 확인
  const separator = url.includes('?') ? '&' : '?';

  // 현재 타임스탬프를 캐시 버스터로 추가
  return `${url}${separator}t=${Date.now()}`;
}