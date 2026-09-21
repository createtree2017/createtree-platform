import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { QueryClient, QueryObserver, focusManager, onlineManager } from '@tanstack/react-query';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { authenticatedFetch, resetAuthRecovery, retryMissionRead, HttpError } from './authenticated-fetch';
import { MissionQueryNotice } from '../components/missions/MissionQueryNotice';
import { loginDestination } from './auth-navigation';
import { apiRequest, getQueryFn, queryClient } from './queryClient';
import { exchangeFirebaseIdToken } from './firebase-session';
import { applyLoginResult } from './login-session';
import { missionQueryOptions } from '../hooks/useMissionQueries';

const originalFetch = globalThis.fetch;
const storage = new Map<string, string>();
const storageMock = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storageMock });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storageMock });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => { resetAuthRecovery(); storage.clear(); });
afterEach(() => { globalThis.fetch = originalFetch; resetAuthRecovery(); });

test('동시 401은 한 번 갱신하고 각 읽기 요청을 한 번 재조회한다', async () => {
  let refreshes = 0;
  let reads = 0;
  globalThis.fetch = async (url, init) => {
    if (url === '/api/auth/refresh-token') { refreshes++; return json({ accessToken: 'new-token' }); }
    reads++;
    return new Headers(init?.headers).get('Authorization') === 'Bearer new-token' ? json(['mission']) : json({}, 401);
  };
  const responses = await Promise.all(Array.from({ length: 5 }, () => authenticatedFetch('/api/missions')));
  assert.equal(refreshes, 1);
  assert.equal(reads, 10);
  assert.ok(responses.every(r => r.status === 200));
});

test('뒤늦게 도착한 이전 토큰의 401도 중복 갱신하지 않는다', async () => {
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (url === '/api/auth/refresh-token') { refreshes++; return json({ accessToken: 'new' }); }
    if (new Headers(init?.headers).has('Authorization')) return json([]);
    if (url === '/api/slow') await delayed;
    return json({}, 401);
  };
  const slow = authenticatedFetch('/api/slow');
  await authenticatedFetch('/api/fast');
  release();
  assert.equal((await slow).status, 200);
  assert.equal(refreshes, 1);
});

test('쓰기 요청은 갱신/자동 재전송하지 않는다', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}, 401); };
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) await authenticatedFetch('/api/missions/1/start', { method });
  assert.equal(calls, 4);
});

test('갱신 후에도 401이면 무한 반복하지 않는다', async () => {
  let calls = 0;
  globalThis.fetch = async url => { calls++; return url === '/api/auth/refresh-token' ? json({ accessToken: 'new' }) : json({}, 401); };
  assert.equal((await authenticatedFetch('/api/missions')).status, 401);
  assert.equal(calls, 3);
});

test('갱신 자격 만료는 원래 401을 반환한다', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}, 401); };
  assert.equal((await authenticatedFetch('/api/missions')).status, 401);
  assert.equal(calls, 2);
});

test('갱신 서버 장애는 503으로 유지하고 토큰을 지우지 않는다', async () => {
  storage.set('auth_token', 'old');
  globalThis.fetch = async url => json({}, url === '/api/auth/refresh-token' ? 503 : 401);
  await assert.rejects(authenticatedFetch('/api/missions'), (error: HttpError) => error.status === 503);
  assert.equal(storage.get('auth_token'), 'old');
});

test('인증 API는 재귀 갱신하지 않는다', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}, 401); };
  await authenticatedFetch('/api/auth/me');
  assert.equal(calls, 1);
});

test('갱신 중 로그아웃/계정 변경 시 늦은 응답을 저장하거나 재조회하지 않는다', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  let started!: () => void;
  const refreshing = new Promise<void>(resolve => { started = resolve; });
  globalThis.fetch = async url => {
    if (url === '/api/auth/refresh-token') { started(); await pending; return json({ accessToken: 'old-account' }); }
    return json({}, 401);
  };
  const request = authenticatedFetch('/api/missions');
  await refreshing;
  resetAuthRecovery();
  storage.set('auth_token', 'new-account');
  finish();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(storage.get('auth_token'), 'new-account');
});

test('취소된 조회는 인증 복구를 시작하지 않는다', async () => {
  const controller = new AbortController();
  globalThis.fetch = async () => { controller.abort(); return json({}, 401); };
  await assert.rejects(authenticatedFetch('/api/missions', { signal: controller.signal }), { name: 'AbortError' });
});

test('네트워크/5xx만 제한적으로 재시도한다', () => {
  assert.equal(retryMissionRead(0, new TypeError('offline')), true);
  assert.equal(retryMissionRead(0, new HttpError(503, 'unavailable')), true);
  for (const status of [401, 403, 404, 429]) assert.equal(retryMissionRead(0, new HttpError(status, 'error')), false);
  assert.equal(retryMissionRead(1, new HttpError(503, 'unavailable')), false);
});

test('최초 실패와 기존 데이터 재조회 실패를 구분하며 이전 목록은 유지한다', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const key = ['/api/missions', 'all', { userId: 7 }];
  const observer = new QueryObserver(client, { queryKey: key, queryFn: async () => { throw new HttpError(503, 'offline'); } });
  const unsubscribe = observer.subscribe(() => {});
  await observer.refetch();
  assert.equal(observer.getCurrentResult().isError, true);
  assert.equal(observer.getCurrentResult().data, undefined);
  client.setQueryData(key, [{ id: 1 }]);
  await observer.refetch();
  assert.deepEqual(observer.getCurrentResult().data, [{ id: 1 }]);
  assert.equal(client.getQueryData(['/api/missions', 'all', { userId: 8 }]), undefined);
  unsubscribe(); client.clear();
});

test('오류 안내는 빈 목록 문구 대신 재시도/로그인 동작을 제공한다', () => {
  const render = (status: number, hasData: boolean) => renderToStaticMarkup(React.createElement(MissionQueryNotice, { error: new HttpError(status, 'error'), hasData, isFetching: false, retry() {} }));
  assert.match(render(503, false), /목록을 불러오지 못했습니다/);
  assert.match(render(503, true), /이전에 불러온 목록/);
  assert.match(render(401, false), /다시 로그인/);
  assert.doesNotMatch(render(503, false), /참여한 미션이 없습니다/);
});

test('로그인 복귀 경로는 내부 URL만 허용한다', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/auth?reason=expired']) {
    storage.set('auth_return_to', value); assert.equal(loginDestination(), '/');
  }
  storage.set('auth_return_to', '/missions?tab=history');
  assert.equal(loginDestination(), '/missions?tab=history');
});

test('공통 쿼리의 사용자별 키는 URL에 잘못된 필터를 추가하지 않는다', async () => {
  const urls: string[] = [];
  globalThis.fetch = async url => { urls.push(String(url)); return json([]); };
  await queryClient.fetchQuery({ queryKey: ['/api/missions/history', { userId: 7 }] });
  await queryClient.fetchQuery({ queryKey: ['/api/missions', 'hospital:3', { userId: 7 }] });
  assert.deepEqual(urls, ['/api/missions/history', '/api/missions?filter=hospital%3A3']);
  queryClient.clear();
});

test('returnNull은 인증 실패에만 적용하고 서버 오류/잘못된 HTML은 숨기지 않는다', async () => {
  globalThis.fetch = async () => json({}, 401);
  assert.equal(await getQueryFn({ on401: 'returnNull' })({ queryKey: ['/api/auth/me'] }), null);
  globalThis.fetch = async () => json({ message: '일시적인 서버 오류' }, 503);
  await assert.rejects(getQueryFn({ on401: 'returnNull' })({ queryKey: ['/api/auth/me'] }), (error: HttpError) => error.status === 503);
  globalThis.fetch = async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(apiRequest('/api/missions'), /HTML/);
});

test('기존 쿼리 문자열 뒤에 필터를 정상적으로 추가한다', async () => {
  let received = '';
  globalThis.fetch = async url => { received = String(url); return json([]); };
  try {
    await queryClient.fetchQuery({ queryKey: ['/api/missions?limit=10', 'public'] });
    assert.equal(received, '/api/missions?limit=10&filter=public');
  } finally { queryClient.clear(); }
});

test('Headers 인스턴스와 튜플 헤더를 모두 보존한다', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('X-Request-Id'), 'test-request');
    return json([]);
  };
  await apiRequest('/api/missions', { headers: new Headers({ 'X-Request-Id': 'test-request' }) });
  await apiRequest('/api/missions', { headers: [['X-Request-Id', 'test-request']] });
});

test('제어문자/경로 정규화로 외부 URL이나 로그인 화면에 복귀하지 않는다', () => {
  for (const value of ['/\n/example.com', '/missions/../auth', '/%2e%2e/auth', '/\t/example.com']) {
    storage.set('auth_return_to', value);
    assert.equal(loginDestination(), '/');
  }
});

test('Firebase 로그인은 사용자 프로필 대신 검증 가능한 idToken을 보낸다', async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, '/api/auth/firebase-login');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'include');
    assert.deepEqual(JSON.parse(init?.body as string), { idToken: 'verified-firebase-token' });
    return json({ token: 'access', user: { id: 7 } });
  };
  assert.equal((await exchangeFirebaseIdToken({ getIdToken: async () => 'verified-firebase-token' })).status, 200);
  await assert.rejects(exchangeFirebaseIdToken({ getIdToken: async () => { throw new Error('SDK failed'); } }), /SDK failed/);
  assert.equal(calls, 1);
});

test('로그인 공통 처리는 이전 계정 데이터/토큰을 제거하고 새로운 사용자만 저장한다', async () => {
  queryClient.setQueryData(['/api/missions', { userId: 7 }], [{ id: 1 }]);
  storage.set('auth_token', 'old-user');
  await applyLoginResult({ user: { id: 8 }, accessToken: 'new-user' });
  assert.equal(queryClient.getQueryData(['/api/missions', { userId: 7 }]), undefined);
  assert.deepEqual(queryClient.getQueryData(['/api/auth/me']), { id: 8 });
  assert.equal(storage.get('auth_token'), 'new-user');
  await applyLoginResult({ user: { id: 9 } });
  assert.equal(storage.get('auth_token'), undefined);
  await assert.rejects(applyLoginResult({ user: { id: NaN } }), /로그인 응답/);
  assert.deepEqual(queryClient.getQueryData(['/api/auth/me']), { id: 9 });
  queryClient.clear();
});

test('문화센터 쿼리는 잘못된 200 JSON을 화면 데이터로 넘기지 않는다', async () => {
  const client = new QueryClient();
  const options = missionQueryOptions({ id: 7 }, 'all', true);
  try {
    for (const malformed of [{ message: 'error' }, [null], [{ id: 1 }]]) {
      globalThis.fetch = async () => json(malformed);
      await assert.rejects(client.fetchQuery({ ...options.missions, retry: false }), (error: HttpError) => error.status === 502);
    }
    globalThis.fetch = async () => json([{ id: 1, missionId: 'culture-1', title: '문화센터' }]);
    assert.equal((await client.fetchQuery(options.missions)).length, 1);
  } finally { client.clear(); }
});

test('로그인 전과 비활성 히스토리는 요청하지 않고 사용자/병원 키를 분리한다', async () => {
  const client = new QueryClient();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json([]); };
  const unsigned = missionQueryOptions(null, 'all', true);
  const hidden = missionQueryOptions({ id: 7 }, 'all', false);
  const observers = [new QueryObserver(client, unsigned.missions), new QueryObserver(client, unsigned.history), new QueryObserver(client, hidden.history)];
  const stops = observers.map(observer => observer.subscribe(() => {}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
  assert.notDeepEqual(hidden.missions.queryKey, missionQueryOptions({ id: 8 }, 'all', false).missions.queryKey);
  assert.notDeepEqual(hidden.missions.queryKey, missionQueryOptions({ id: 7, hospitalId: 9 }, 'all', false).missions.queryKey);
  stops.forEach(stop => stop()); client.clear();
});

test('실제 문화센터 쿼리 옵션으로 복귀/재연결 시 오래된 데이터만 재조회한다', async () => {
  const client = new QueryClient();
  const options = missionQueryOptions({ id: 7 }, 'all', true).missions;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json([]); };
  client.mount();
  const observer = new QueryObserver(client, options);
  const stop = observer.subscribe(() => {});
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  try {
    await observer.refetch();
    assert.equal(calls, 1);
    focusManager.setFocused(false); focusManager.setFocused(true); await flush();
    assert.equal(calls, 1, '신선한 데이터는 복귀 시 추가 호출하지 않는다');
    client.setQueryData(options.queryKey, [], { updatedAt: Date.now() - 31_000 });
    focusManager.setFocused(false); focusManager.setFocused(true); await flush();
    assert.equal(calls, 2);
    client.setQueryData(options.queryKey, [], { updatedAt: Date.now() - 31_000 });
    onlineManager.setOnline(false); onlineManager.setOnline(true); await flush();
    assert.equal(calls, 3);
  } finally {
    stop(); client.unmount(); client.clear(); focusManager.setFocused(undefined); onlineManager.setOnline(true);
  }
});

test('실제 쿼리는 503만 한 번 재시도하고 401 반복 조회를 막는다', async () => {
  const client = new QueryClient();
  const options = missionQueryOptions({ id: 7 }, 'all', true).missions;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return json({ message: 'unavailable' }, 503); };
    await assert.rejects(client.fetchQuery({ ...options, retryDelay: 0 }));
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => { calls++; return json({ message: 'expired' }, 401); };
    await assert.rejects(client.fetchQuery({ ...options, retryDelay: 0 }));
    assert.equal(calls, 2, '원래 요청과 갱신 요청만 실행한다');
  } finally { client.clear(); }
});

test('한 조회를 취소해도 공유 갱신을 기다리는 다른 조회는 정상 복구한다', async () => {
  const controller = new AbortController();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const refreshing = new Promise<void>(resolve => { started = resolve; });
  let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (url === '/api/auth/refresh-token') {
      refreshes++; started(); await pending; return json({ accessToken: 'new' });
    }
    return new Headers(init?.headers).has('Authorization') ? json([]) : json({}, 401);
  };
  const cancelled = authenticatedFetch('/api/missions', { signal: controller.signal });
  const retained = authenticatedFetch('/api/missions/history');
  await refreshing; controller.abort(); release();
  await assert.rejects(cancelled, { name: 'AbortError' });
  assert.equal((await retained).status, 200);
  assert.equal(refreshes, 1);
});

test('잘못된 갱신 응답 이후에도 다음 정상 요청은 복구할 수 있다', async () => {
  let valid = false;
  globalThis.fetch = async (url, init) => {
    if (url === '/api/auth/refresh-token') return json(valid ? { accessToken: 'new' } : { success: true });
    return new Headers(init?.headers).has('Authorization') ? json([]) : json({}, 401);
  };
  await assert.rejects(authenticatedFetch('/api/missions'), (error: HttpError) => error.status === 502);
  assert.equal(storage.get('auth_token'), undefined);
  valid = true;
  assert.equal((await authenticatedFetch('/api/missions')).status, 200);
});
