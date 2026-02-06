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
 * 허용 태그: b, strong, i, em, br, span (color/font-size 스타일만 허용), div, p
 * div/p 태그는 줄바꿈용으로 변환됨
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // DEBUG: 입력 HTML 확인
  console.log('[sanitizeHtml] Input:', html);

  let result = html;

  // 스크립트 태그와 이벤트 핸들러 제거 (먼저 처리)
  result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  result = result.replace(/on\w+\s*=/gi, '');
  result = result.replace(/javascript:/gi, '');

  // font 태그를 span style로 변환 (color와 size 모두 처리)
  result = result.replace(/<font([^>]*)>/gi, (match, attrs) => {
    const styles: string[] = [];

    // color 속성 추출
    const colorMatch = attrs.match(/color\s*=\s*["']?([^"'\s>]+)["']?/i);
    if (colorMatch) {
      styles.push(`color: ${colorMatch[1]}`);
    }

    // size 속성 추출 (1-7 → CSS font-size 변환)
    const sizeMatch = attrs.match(/size\s*=\s*["']?([1-7])["']?/i);
    if (sizeMatch) {
      const fontSizeMap: Record<string, string> = {
        '1': '0.625rem',  // xx-small (10px)
        '2': '0.8125rem', // small (13px)
        '3': '1rem',      // medium (16px) - 기본
        '4': '1.125rem',  // large (18px)
        '5': '1.5rem',    // x-large (24px)
        '6': '2rem',      // xx-large (32px)
        '7': '3rem',      // xxx-large (48px)
      };
      const fontSize = fontSizeMap[sizeMatch[1]] || '1rem';
      styles.push(`font-size: ${fontSize}`);
    }

    if (styles.length > 0) {
      return `<span style="${styles.join('; ')}">`;
    }
    return '<span>';
  });
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

    // span 태그일 경우 color와 font-size 스타일 추출
    if (tag === 'span') {
      // 먼저 style 속성 전체를 추출
      const styleAttrMatch = attrs.match(/style\s*=\s*["']([^"']+)["']/i);
      if (styleAttrMatch) {
        const styleContent = styleAttrMatch[1];
        const styles: string[] = [];

        // color 추출
        const colorMatch = styleContent.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        if (colorMatch) {
          const color = colorMatch[1].trim();
          const safeColorPattern = /^(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-zA-Z]+)$/;
          if (safeColorPattern.test(color)) {
            styles.push(`color: ${color}`);
          }
        }

        // font-size 추출
        const fontSizeMatch = styleContent.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
        if (fontSizeMatch) {
          const fontSize = fontSizeMatch[1].trim();
          // 숫자+단위 또는 CSS 키워드 허용
          const safeFontSizePattern = /^([\d.]+(rem|em|px|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i;
          if (safeFontSizePattern.test(fontSize)) {
            styles.push(`font-size: ${fontSize}`);
          }
        }

        if (styles.length > 0) {
          return `<span style="${styles.join('; ')}">`;
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