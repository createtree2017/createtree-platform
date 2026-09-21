import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import express, { type Request } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import { Passport } from 'passport';
import { createAuthRecovery, createRefreshHandler } from '../services/auth-recovery';
import { authenticatedFetch, resetAuthRecovery } from '../../client/src/lib/authenticated-fetch';

const secret = 'isolated-test-secret';
const user = { id: 7, hospitalId: 3, memberType: 'membership', isDeleted: false };
const sign = (value = user, expiresIn = 3600) => jwt.sign({ ...value, userId: value.id }, secret, { expiresIn });
const request = (overrides = {}) => ({ cookies: {}, headers: {}, session: {}, isAuthenticated: () => false, ...overrides }) as unknown as Request;
const recovery = (overrides = {}) => createAuthRecovery({
  secret, findUser: async (id: number) => id === user.id ? user : undefined,
  generateToken: sign,
  refreshAccessToken: async (token: string) => token === 'valid-refresh' ? sign() : null,
  ...overrides,
});

test('세션이 유효하면 만료 JWT를 최신 사용자 정보로 복구한다', async () => {
  const result = await recovery()(request({ cookies: { auth_token: sign(user, -1) }, isAuthenticated: () => true, user }));
  assert.equal(result?.user.id, user.id);
  const claims = jwt.verify(result!.accessToken!, secret) as jwt.JwtPayload;
  assert.equal(claims.hospitalId, 3);
});

test('기존 Google 서버 세션도 만료 JWT를 복구한다', async () => {
  assert.ok((await recovery()(request({ session: { user }, cookies: { auth_token: sign(user, -1) } })))?.accessToken);
});

test('세션 소실 후 유효한 갱신 토큰으로 복구한다', async () => {
  assert.ok((await recovery()(request({ cookies: { refreshToken: 'valid-refresh' } })))?.accessToken);
});

test('만료 JWT만으로는 재발급하지 않는다', async () => {
  assert.equal(await recovery()(request({ cookies: { auth_token: sign(user, -1) } })), null);
});

test('위조 토큰/만료 갱신 토큰/무인증을 거부한다', async () => {
  for (const cookies of [{}, { auth_token: 'forged' }, { refreshToken: 'expired' }]) {
    assert.equal(await recovery()(request({ cookies })), null);
  }
});

test('유효한 JWT는 조회 가능하나 JWT만으로 강제 갱신하지 않는다', async () => {
  const req = request({ cookies: { auth_token: sign() } });
  assert.equal((await recovery()(req))?.accessToken, undefined);
  assert.equal(await recovery()(req, true), null);
});

test('탈퇴/삭제 사용자는 세션 또는 갱신 토큰이 남아 있어도 거부한다', async () => {
  for (const value of [undefined, { ...user, isDeleted: true }]) {
    const recover = recovery({ findUser: async () => value });
    assert.equal(await recover(request({ session: { user } }), true), null);
    assert.equal(await recover(request({ cookies: { refreshToken: 'valid-refresh' } }), true), null);
  }
});

test('세션 사용자가 바뀌면 이전 계정 JWT를 교체한다', async () => {
  const oldUser = { ...user, id: 10, hospitalId: 99 };
  const result = await recovery()(request({ session: { user }, cookies: { auth_token: sign(oldUser) } }));
  assert.equal((jwt.verify(result!.accessToken!, secret) as jwt.JwtPayload).userId, user.id);
});

test('DB 장애를 인증 만료로 숨기지 않는다', async () => {
  await assert.rejects(recovery({ findUser: async () => { throw new Error('DB unavailable'); } })(request({ session: { user } })));
});

test('세션 없이 병원/권한이 바뀌면 원래 JWT 만료시간을 유지하며 최신 정보를 반영한다', async () => {
  const token = sign({ ...user, hospitalId: 99, memberType: 'free' }, 90);
  const result = await recovery()(request({ cookies: { auth_token: token } }));
  const updated = jwt.verify(result!.accessToken!, secret) as jwt.JwtPayload;
  assert.equal(updated.exp, (jwt.verify(token, secret) as jwt.JwtPayload).exp);
  assert.equal(updated.hospitalId, user.hospitalId);
  assert.equal(updated.memberType, user.memberType);
});

test('새 Express 서버에서 실제 갱신 핸들러는 JSON/쿠키/상태코드를 반환한다', async () => {
  const app = express();
  app.use(cookieParser());
  app.post('/api/auth/refresh-token', createRefreshHandler(recovery()));
  app.post('/unavailable', createRefreshHandler(recovery({ refreshAccessToken: async () => { throw new Error('DB'); } })));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(`${base}/api/auth/refresh-token`, { method: 'POST', headers: { cookie: 'refreshToken=valid-refresh' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('set-cookie')!, /auth_token=.*HttpOnly/);
    assert.ok((await response.json()).accessToken);
    assert.equal((await fetch(`${base}/api/auth/refresh-token`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${base}/unavailable`, { method: 'POST', headers: { cookie: 'refreshToken=valid-refresh' } })).status, 503);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});

test('운영 라우트에는 갱신 핸들러가 정확히 한 번 등록된다', () => {
  const routes = readFileSync('server/routes/auth.ts', 'utf8');
  assert.equal(routes.match(/router\.post\("\/refresh-token"/g)?.length, 1);
  assert.match(routes, /router\.post\("\/refresh-token", createRefreshHandler\(recoverAuth\)\)/);
});

test('Bearer 형식이 없는 Authorization 값은 로그인으로 인정하지 않는다', async () => {
  assert.equal(await recovery()(request({ headers: { authorization: sign() } })), null);
});

test('실제 Passport 세션 → JWT 복구 → 세션 소실 후 갱신 → 로그아웃을 HTTP로 검증한다', async () => {
  const app = express();
  const store = new session.MemoryStore();
  const passport = new Passport();
  const passportUser: Express.User = {
    ...user, username: 'test-user', password: null, email: null, fullName: null,
    emailVerified: true, promoCode: null, lastLogin: null, phoneNumber: null,
    dueDate: null, birthdate: null, firebaseUid: null, needProfileComplete: false,
    deletedAt: null, isSystemPushAgreed: false, isMarketingPushAgreed: false,
    createdAt: new Date(), updatedAt: new Date(),
  };
  passport.serializeUser((current: Express.User, done) => done(null, (current as typeof user).id));
  passport.deserializeUser((id: number, done) => done(null, id === user.id ? passportUser : false));
  app.use(cookieParser());
  app.use(session({ store, name: 'test.sid', secret: 'test-session-secret', resave: false, saveUninitialized: false }));
  app.use(passport.initialize()); app.use(passport.session());
  let revoked = false;
  let refreshes = 0;
  const recover = recovery({ refreshAccessToken: async (token: string) => !revoked && token === 'valid-refresh' ? sign() : null });
  app.post('/session-login', (req, res, next) => {
    req.logIn(passportUser, error => {
      if (error) return next(error);
      res.cookie('auth_token', sign(user, -1));
      res.json({ success: true });
    });
  });
  app.post('/api/auth/refresh-token', (req, _res, next) => { refreshes++; next(); }, createRefreshHandler(recover));
  app.get('/api/missions', (req, res) => {
    try {
      const verified = jwt.verify(req.cookies.auth_token || '', secret) as jwt.JwtPayload;
      res.json([{ id: 1, missionId: 'culture-1', title: '문화센터', userId: verified.userId }]);
    } catch { res.status(401).json({ message: 'expired' }); }
  });
  app.post('/session-logout', (req, res) => {
    revoked = true;
    req.session.destroy(() => {
      res.clearCookie('auth_token'); res.clearCookie('test.sid'); res.clearCookie('refreshToken');
      res.json({ success: true });
    });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const nativeFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const tokens = new Map<string, string>();
  const cookies = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => tokens.get(key) ?? null,
    setItem: (key: string, value: string) => tokens.set(key, value),
  } });
  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Cookie', [...cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    const result = await nativeFetch(new URL(String(url), base), { ...init, headers });
    for (const header of result.headers.getSetCookie()) {
      const pair = header.split(';')[0];
      const separator = pair.indexOf('=');
      const key = pair.slice(0, separator), value = pair.slice(separator + 1);
      if (value) cookies.set(key, value); else cookies.delete(key);
    }
    return result;
  };
  try {
    resetAuthRecovery();
    assert.equal((await fetch('/session-login', { method: 'POST' })).status, 200);
    assert.ok(cookies.has('test.sid'));
    const response = await authenticatedFetch('/api/missions');
    assert.equal(response.status, 200);
    assert.equal((await response.json())[0].userId, user.id);
    assert.equal(refreshes, 1);

    await new Promise<void>((resolve, reject) => store.clear(error => error ? reject(error) : resolve()));
    cookies.set('auth_token', sign(user, -1));
    cookies.set('refreshToken', 'valid-refresh');
    assert.equal((await authenticatedFetch('/api/missions')).status, 200);
    assert.equal(refreshes, 2);

    await fetch('/session-logout', { method: 'POST' });
    tokens.clear(); resetAuthRecovery();
    assert.equal((await authenticatedFetch('/api/missions')).status, 401);
    assert.equal(refreshes, 3);
  } finally {
    resetAuthRecovery(); globalThis.fetch = nativeFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
