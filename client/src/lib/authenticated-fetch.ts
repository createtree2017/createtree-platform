let refreshPromise: Promise<boolean> | undefined;
let refreshController: AbortController | undefined;
let tokenVersion = 0;
let authEpoch = 0;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// 로그인/로그아웃 전후의 오래된 요청이 인증 상태를 덮어쓰지 않게 한다.
export function resetAuthRecovery() {
  authEpoch++;
  tokenVersion++;
  refreshController?.abort();
  refreshController = undefined;
  refreshPromise = undefined;
}

function authenticatedHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  const token = localStorage.getItem('auth_token');
  if (token) result.set('Authorization', `Bearer ${token}`);
  return result;
}

async function refreshAuthentication(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const epoch = authEpoch;
  const controller = new AbortController();
  refreshController = controller;
  const pending = (async () => {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST', credentials: 'include', signal: controller.signal,
      headers: authenticatedHeaders(),
    });
    if (epoch !== authEpoch) throw new DOMException('인증 상태가 변경되었습니다.', 'AbortError');
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) throw new HttpError(response.status, '로그인 상태를 확인하지 못했습니다. 다시 시도해주세요.');
    const data = await response.json();
    if (epoch !== authEpoch) throw new DOMException('인증 상태가 변경되었습니다.', 'AbortError');
    if (typeof data.accessToken !== 'string' || !data.accessToken) {
      throw new HttpError(502, '로그인 갱신 응답을 확인하지 못했습니다.');
    }
    localStorage.setItem('auth_token', data.accessToken);
    tokenVersion++;
    return true;
  })();
  refreshPromise = pending;
  try {
    return await pending;
  } finally {
    if (refreshPromise === pending) {
      refreshPromise = undefined;
      refreshController = undefined;
    }
  }
}

// 읽기 요청만 인증 갱신 후 1회 재전송한다. 쓰기 요청은 중복 실행하지 않는다.
export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const epoch = authEpoch;
  const version = tokenVersion;
  const send = () => fetch(url, { ...init, credentials: 'include', headers: authenticatedHeaders(init.headers) });
  const assertActive = () => {
    if (epoch !== authEpoch || init.signal?.aborted) {
      throw new DOMException('요청이 취소되었습니다.', 'AbortError');
    }
  };
  const response = await send();
  assertActive();
  const method = (init.method || 'GET').toUpperCase();
  if (response.status !== 401 || !['GET', 'HEAD'].includes(method) || url.startsWith('/api/auth/')) {
    return response;
  }
  if (version === tokenVersion && !await refreshAuthentication()) return response;
  assertActive();
  const retried = await send();
  assertActive();
  return retried;
}

export function retryMissionRead(failureCount: number, error: Error) {
  if (error.name === 'AbortError') return false;
  const status = (error as Error & { status?: number }).status;
  return failureCount < 1 && (status === undefined || status >= 500 || status === 408);
}
