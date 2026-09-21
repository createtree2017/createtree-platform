import { queryClient } from './queryClient';
import { resetAuthRecovery } from './authenticated-fetch';

export async function applyLoginResult(data: { user: { id: number }; token?: string; accessToken?: string }) {
  if (!data.user || !Number.isInteger(data.user.id)) throw new Error('로그인 응답을 확인하지 못했습니다.');
  resetAuthRecovery();
  await queryClient.cancelQueries();
  queryClient.removeQueries({ predicate: query => query.queryKey[0] !== '/api/auth/me' });
  const token = data.token || data.accessToken;
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
  queryClient.setQueryData(['/api/auth/me'], data.user);
}
