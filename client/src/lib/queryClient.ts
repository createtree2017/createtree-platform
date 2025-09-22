import { QueryClient } from "@tanstack/react-query";

// 기본 fetcher 함수
const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = queryKey[0] as string;
  const filter = queryKey[1] as string;
  
  // 필터링 파라미터 추가
  const filterParam = filter && filter !== "all" ? `?filter=${filter}` : "";
  const finalUrl = `${url}${filterParam}`;
  
  // JWT 토큰 포함 - 쿠키에서 읽기
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // 쿠키에서 JWT 토큰 추출
  const getCookieValue = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };
  
  const jwtToken = getCookieValue('auth_token');
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  
  // JWT 토큰과 쿠키 인증 모두 포함
  const response = await fetch(finalUrl, {
    method: 'GET',
    credentials: 'include', // 쿠키 포함
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('401: Unauthorized');
    }
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
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
}

export const getQueryFn = 
  (options: ApiRequestOptions = {}) => 
  async <T>({ queryKey }: { queryKey: readonly unknown[] }): Promise<T | null> => {
    const url = queryKey[0] as string;
    
    try {
      // 기존 apiRequest 함수 재사용
      const response = await apiRequest(url, {
        ...options,
        method: 'GET'
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
      
      if (options.on401 === "returnNull") {
        return null;
      }
      
      throw error;
    }
  };

export const apiRequest = async (
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const method = options.method || "GET";
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  // Add custom headers if provided
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // JWT 토큰이 있으면 Authorization 헤더에 포함 - 쿠키에서 읽기
  const getCookieValue = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };
  
  const jwtToken = getCookieValue('auth_token');
  if (jwtToken) {
    (headers as any)['Authorization'] = `Bearer ${jwtToken}`;
  }
  
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
  };
  
  // 요청 본문 데이터 처리
  if (options.data && method !== "GET") {
    config.body = JSON.stringify(options.data);
  } else if (options.body && method !== "GET") {
    // HospitalManagement에서 사용하는 body 속성 지원
    config.body = options.body;
  }
  
  console.log(`API 요청: ${method} ${finalUrl}`);
  const response = await fetch(finalUrl, config);
  
  // JWT 토큰 만료시 재로그인 처리
  if (response.status === 401 && jwtToken && url !== '/api/auth/login') {
    console.log("[JWT 토큰] 만료됨, 재로그인이 필요합니다");
    
    // 토큰 삭제하고 로그인 페이지로 리다이렉트
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
  
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
    console.error(`API 오류: ${method} ${finalUrl}`, error);
    throw error;
  }
  
  return response;
};