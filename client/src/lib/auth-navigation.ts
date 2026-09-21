const destinationKey = 'auth_return_to';

export function rememberLoginDestination() {
  sessionStorage.setItem(destinationKey, window.location.pathname + window.location.search + window.location.hash);
}

export function loginDestination() {
  const path = sessionStorage.getItem(destinationKey);
  // 외부 URL, 로그인 화면으로의 재귀 복귀를 허용하지 않는다.
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path)) return '/';
  try {
    const base = 'https://internal.invalid';
    const parsed = new URL(path, base);
    if (parsed.origin !== base || /^\/(auth|login)(\/|$)/.test(parsed.pathname)) return '/';
    return parsed.pathname + parsed.search + parsed.hash;
  } catch { return '/'; }
}

export function clearLoginDestination() {
  sessionStorage.removeItem(destinationKey);
}
