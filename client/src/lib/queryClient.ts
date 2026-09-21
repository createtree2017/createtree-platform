import { QueryClient } from "@tanstack/react-query";

import { authenticatedFetch, HttpError } from './authenticated-fetch';

const defaultQueryFn = async ({ queryKey, signal }: { queryKey: readonly unknown[]; signal: AbortSignal }) => {
  const url = queryKey[0] as string;
  const filter = typeof queryKey[1] === 'string' ? queryKey[1] : undefined;
  const filterParam = filter && filter !== 'all' ? `${url.includes('?') ? '&' : '?'}filter=${encodeURIComponent(filter)}` : '';
  const response = await apiRequest(`${url}${filterParam}`, { signal });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new HttpError(502, '목록 응답을 확인하지 못했습니다. 다시 시도해주세요.');
  }
  return response.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
      retry: false,
      retryOnMount: false,
      staleTime: 30000, // 30초
      gcTime: 300000, // 5분
      queryFn: defaultQueryFn,
    },
  },
});

export interface ApiRequestOptions {
  headers?: HeadersInit;
  on401?: "throw" | "returnNull";
  params?: Record<string, string | number | boolean>;
  method?: string;
  data?: any;
  body?: string;
  signal?: AbortSignal;
}

export const getQueryFn =
  (options: ApiRequestOptions = {}) =>
    async <T>({ queryKey, signal }: { queryKey: readonly unknown[]; signal?: AbortSignal }): Promise<T | null> => {
      const url = queryKey[0] as string;

      try {
        // 기존 apiRequest 함수 재사용
        const response = await apiRequest(url, {
          ...options,
          method: 'GET',
          signal: signal ?? options.signal
        });

        if (response.status === 401 && options.on401 === "returnNull") {
          return null;
        }

        // Content-Type 헤더 확인
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`API 응답이 JSON 형식이 아닙니다: ${url}`, contentType);
          throw new Error(`서버가 유효하지 않은 응답 형식을 반환했습니다 (${contentType || '없음'})`);
        }

        return await response.json() as T;
      } catch (error) {
        console.error(`API error for ${url}:`, error);

        if (options.on401 === "returnNull" && (error as { status?: number }).status === 401) {
          return null;
        }

        throw error;
      }
    };

export const apiRequest = async (
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  // URL에 쿼리 파라미터 추가 처리
  let finalUrl = url;
  if (options.params) {
    const queryParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });

    const queryString = queryParams.toString();
    if (queryString) {
      finalUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
    }
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
  };

  // 요청 본문 데이터 처리
  if (options.data && method !== "GET") {
    config.body = JSON.stringify(options.data);
  } else if (options.body && method !== "GET") {
    // HospitalManagement에서 사용하는 body 속성 지원
    config.body = options.body;
  }

  console.log(`API 요청: ${method} ${finalUrl}`);
  const response = await authenticatedFetch(finalUrl, config);
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (response.status === 401 && options.on401 === "returnNull") {
      return response;
    }

    // 응답의 Content-Type 확인
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    // 응답 내용 가져오기
    const responseText = await response.text();
    let errorMessage = `API error ${response.status}`;

    // JSON 응답인 경우 에러 메시지 추출 시도
    if (isJson && responseText) {
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        console.warn("JSON 파싱 오류:", parseError);
        errorMessage = responseText || errorMessage;
      }
    } else {
      // HTML 또는 다른 형식의 응답인 경우
      errorMessage = "서버가 예상치 못한 응답을 반환했습니다. 관리자에게 문의하세요.";
      console.error("비정상 응답:", responseText);
    }

    const error = new Error(errorMessage);
    (error as Error & { status?: number }).status = response.status;
    console.error(`API 오류: ${method} ${finalUrl}`, error);
    throw error;
  }

  if (finalUrl.startsWith('/api') && contentType.includes('text/html')) {
    const responseText = await response.text();
    console.error("API 경로에서 HTML 응답을 받았습니다:", responseText);
    const error = new Error("API 요청이 화면 HTML을 반환했습니다. 서버 라우트 등록 또는 재시작 상태를 확인하세요.");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response;
};
