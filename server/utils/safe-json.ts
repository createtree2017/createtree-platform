/**
 * 안전한 JSON 파싱 유틸리티
 * 
 * 목적: JSON.parse의 SyntaxError로 인한 서버 크래시 방지
 * 작성일: 2026-01-30
 */

export interface SafeParseResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
}

/**
 * 안전하게 JSON을 파싱합니다
 * 
 * @param value - 파싱할 값
 * @param fallback - 실패 시 기본값 (optional)
 * @returns 파싱된 데이터 또는 fallback
 * 
 * @example
 * // 기본 사용
 * const data = safeJsonParse(req.body.data, {});
 * 
 * // 이미 객체면 그대로 반환
 * safeJsonParse({ foo: 'bar' }) // → { foo: 'bar' }
 * 
 * // 잘못된 JSON
 * safeJsonParse('invalid json', {}) // → {}
 */
export function safeJsonParse<T = any>(
    value: unknown,
    fallback?: T
): T | undefined {
    // 이미 객체/배열이면 그대로 반환
    if (typeof value === 'object' && value !== null) {
        return value as T;
    }

    // 문자열이 아니면 fallback
    if (typeof value !== 'string') {
        return fallback;
    }

    // 빈 문자열은 fallback
    if (value.trim() === '') {
        return fallback;
    }

    try {
        return JSON.parse(value) as T;
    } catch (error) {
        console.warn('⚠️ [JSON 파싱 실패]', {
            value: value.substring(0, 100),
            error: error instanceof Error ? error.message : 'Unknown'
        });
        return fallback;
    }
}

/**
 * 더 상세한 결과를 반환하는 버전
 * 
 * @param value - 파싱할 값
 * @returns 성공 여부와 데이터 또는 에러
 * 
 * @example
 * const result = safeJsonParseWithResult(req.body.data);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export function safeJsonParseWithResult<T = any>(
    value: unknown
): SafeParseResult<T> {
    // 이미 객체/배열
    if (typeof value === 'object' && value !== null) {
        return { success: true, data: value as T };
    }

    // 문자열이 아님
    if (typeof value !== 'string') {
        return {
            success: false,
            error: new Error('값이 문자열이 아닙니다')
        };
    }

    // 빈 문자열
    if (value.trim() === '') {
        return {
            success: false,
            error: new Error('빈 문자열입니다')
        };
    }

    try {
        const parsed = JSON.parse(value);
        return { success: true, data: parsed as T };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error : new Error('파싱 실패')
        };
    }
}

/**
 * 배열 전용 안전 파서
 * 
 * @param value - 파싱할 값
 * @param fallback - 실패 시 기본값 (기본: 빈 배열)
 * @returns 파싱된 배열 또는 fallback
 * 
 * @example
 * // 성공
 * safeJsonParseArray('["a","b"]') // → ["a", "b"]
 * 
 * // 잘못된 JSON
 * safeJsonParseArray('invalid') // → []
 * 
 * // 배열이 아닌 결과
 * safeJsonParseArray('{"foo":"bar"}') // → [] (경고 로그)
 */
export function safeJsonParseArray<T = any>(
    value: unknown,
    fallback: T[] = []
): T[] {
    const result = safeJsonParse<T[]>(value, fallback);

    // 파싱은 성공했지만 배열이 아닌 경우
    if (!Array.isArray(result)) {
        console.warn('⚠️ [타입 불일치] JSON.parse 결과가 배열이 아닙니다:', {
            type: typeof result,
            value: result
        });
        return fallback;
    }

    return result;
}

/**
 * 객체 전용 안전 파서
 * 
 * @param value - 파싱할 값
 * @param fallback - 실패 시 기본값 (기본: 빈 객체)
 * @returns 파싱된 객체 또는 fallback
 * 
 * @example
 * // 성공
 * safeJsonParseObject('{"foo":"bar"}') // → { foo: "bar" }
 * 
 * // 배열인 경우
 * safeJsonParseObject('["a","b"]') // → {} (경고 로그)
 */
export function safeJsonParseObject<T extends object>(
    value: unknown,
    fallback?: T
): T | {} {
    const result = safeJsonParse<T>(value, fallback);

    // 파싱은 성공했지만 객체가 아닌 경우
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        console.warn('⚠️ [타입 불일치] JSON.parse 결과가 객체가 아닙니다:', {
            type: Array.isArray(result) ? 'array' : typeof result,
            value: result
        });
        return fallback || {};
    }

    return result;
}

/**
 * Firebase Storage URL 검증
 * 
 * @param url - 검증할 URL
 * @returns URL이 허용된 도메인인지 여부
 */
export function isValidFirebaseUrl(url: unknown): boolean {
    if (typeof url !== 'string') {
        return false;
    }

    const ALLOWED_DOMAINS = [
        'https://firebasestorage.googleapis.com/',
        'https://storage.googleapis.com/createtree-upload/'
    ];

    return ALLOWED_DOMAINS.some(domain => url.startsWith(domain));
}

/**
 * URL 배열 검증
 * 
 * @param urls - 검증할 URL 배열
 * @returns 검증 결과 및 에러 목록
 * 
 * @example
 * const validation = validateImageUrls(['https://firebasestorage...']);
 * if (!validation.valid) {
 *   return res.status(400).json({ errors: validation.errors });
 * }
 */
export function validateImageUrls(urls: unknown): {
    valid: boolean;
    errors: string[]
} {
    const errors: string[] = [];

    if (!Array.isArray(urls)) {
        return { valid: false, errors: ['URL 목록이 배열이 아닙니다'] };
    }

    if (urls.length === 0) {
        return { valid: false, errors: ['URL이 하나도 없습니다'] };
    }

    urls.forEach((url, index) => {
        if (typeof url !== 'string') {
            errors.push(`${index + 1}번째 항목이 문자열이 아닙니다 (타입: ${typeof url})`);
        } else if (url.trim() === '') {
            errors.push(`${index + 1}번째 URL이 빈 문자열입니다`);
        } else if (!isValidFirebaseUrl(url)) {
            errors.push(`${index + 1}번째 URL이 허용된 도메인이 아닙니다`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}
