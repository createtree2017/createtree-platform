/**
 * 중앙 집중식 날짜 유틸리티 모듈
 * 모든 날짜는 한국 시간대(Asia/Seoul) 기준으로 처리됩니다.
 */

const KOREA_TIMEZONE = 'Asia/Seoul';

/**
 * 날짜 문자열을 한국 시간대 기준으로 파싱
 * DB에서 받은 date-only 문자열(2026-01-25)을 한국 시간 기준으로 해석
 */
export function parseKoreanDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  try {
    // date-only 형식인지 확인 (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // date-only: 한국 시간대(+09:00) 자정으로 해석
      // ISO 형식에 KST 오프셋을 명시적으로 붙여서 파싱
      return new Date(`${dateString}T00:00:00+09:00`);
    }

    // ISO 형식 또는 timestamp인 경우 그대로 파싱
    return new Date(dateString);
  } catch (e) {
    console.error('날짜 파싱 오류:', e);
    return null;
  }
}

/**
 * Date 객체를 한국 시간대 기준 Date 부분만 추출
 * 시간대 변환 없이 날짜만 비교할 때 사용
 */
export function getKoreanDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KOREA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === 'year')?.value || '0'),
    month: parseInt(parts.find(p => p.type === 'month')?.value || '0'),
    day: parseInt(parts.find(p => p.type === 'day')?.value || '0')
  };
}

/**
 * 연/월/일 전체 표시
 * @example "2026년 1월 23일"
 */
export function formatFullDate(dateString: string | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = parseKoreanDate(dateString);
    if (!date) return '';

    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: KOREA_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    console.error('날짜 포맷 오류:', e);
    return '';
  }
}

/**
 * 월/일만 표시 (간단한 형식)
 * @example "01월 23일"
 */
export function formatShortDate(dateString: string | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = parseKoreanDate(dateString);
    if (!date) return '';

    const parts = getKoreanDateParts(date);
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    return `${month}월 ${day}일`;
  } catch (e) {
    console.error('날짜 포맷 오류:', e);
    return '';
  }
}

/**
 * 날짜 범위 표시
 * @example "01월 23일 ~ 01월 25일" 또는 "2026년 1월 23일 ~ 2026년 1월 25일"
 */
export function formatDateRange(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  options: { shortFormat?: boolean } = { shortFormat: true }
): string {
  const formatter = options.shortFormat ? formatShortDate : formatFullDate;

  const start = formatter(startDate);
  const end = formatter(endDate);

  if (start && end) {
    if (start === end) return start;
    return `${start} ~ ${end}`;
  }
  if (start) return `${start} ~`;
  if (end) return `~ ${end}`;
  return '';
}

/**
 * 날짜+시간 표시
 * @example "2026년 1월 23일 오후 3:00"
 */
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: KOREA_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (e) {
    console.error('날짜 포맷 오류:', e);
    return '';
  }
}

/**
 * 기간 상태 판단 (준비중/진행중/마감)
 */
export type PeriodStatus = 'upcoming' | 'active' | 'closed';

export function getPeriodStatus(
  startDate: string | undefined | null,
  endDate: string | undefined | null
): PeriodStatus {
  const now = new Date();
  const nowParts = getKoreanDateParts(now);
  const nowValue = nowParts.year * 10000 + nowParts.month * 100 + nowParts.day;

  if (startDate) {
    const start = parseKoreanDate(startDate);
    if (start) {
      const startParts = getKoreanDateParts(start);
      const startValue = startParts.year * 10000 + startParts.month * 100 + startParts.day;
      if (nowValue < startValue) {
        return 'upcoming';
      }
    }
  }

  if (endDate) {
    const end = parseKoreanDate(endDate);
    if (end) {
      const endParts = getKoreanDateParts(end);
      const endValue = endParts.year * 10000 + endParts.month * 100 + endParts.day;
      if (nowValue > endValue) {
        return 'closed';
      }
    }
  }

  return 'active';
}

/**
 * 간단한 날짜 표시 (toLocaleDateString 대체)
 * @example "2026. 1. 23."
 */
export function formatSimpleDate(dateString: string | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = parseKoreanDate(dateString);
    if (!date) return '';

    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: KOREA_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    console.error('날짜 포맷 오류:', e);
    return '';
  }
}

/**
 * 간단한 날짜 표시에 요일 추가
 * @example "2026. 1. 23. (금)"
 */
export function formatSimpleDateWithDay(dateString: string | undefined | null): string {
  if (!dateString) return '';

  try {
    const date = parseKoreanDate(dateString);
    if (!date) return '';

    // year, month, day 포맷
    const ymd = new Intl.DateTimeFormat('ko-KR', {
      timeZone: KOREA_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).format(date);

    // 요일 포맷
    const weekday = new Intl.DateTimeFormat('ko-KR', {
      timeZone: KOREA_TIMEZONE,
      weekday: 'short'
    }).format(date);

    // 공백을 붙여 예쁘게 조립 (1일이면 "1." 으로 끝나므로 공백 추가)
    return `${ymd} (${weekday})`;
  } catch (e) {
    console.error('날짜 포맷 오류:', e);
    return '';
  }
}

/**
 * input[type="date"]용 날짜 포맷 (YYYY-MM-DD)
 * 문자열 또는 Date 객체 모두 처리 가능
 */
export function formatDateForInput(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  try {
    let date: Date | null;

    if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = parseKoreanDate(dateInput);
    }

    if (!date) return '';

    const parts = getKoreanDateParts(date);
    const year = parts.year;
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('날짜 포맷 오류:', e);
    return '';
  }
}

/**
 * 행사일시 표시 (시작일만 또는 시작일~종료일)
 */
export function formatEventDate(
  startDate: string | undefined | null,
  endDate?: string | undefined | null
): string {
  if (!startDate) return '';

  const start = formatShortDate(startDate);

  if (endDate) {
    const end = formatShortDate(endDate);
    if (start === end) return start;
    return `${start} ~ ${end}`;
  }

  return start;
}
