import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { inquiryDetailSchema, inquiryListSchema } from '@shared/inquiries';
import { createInquiryService, type InquiryService } from '../services/inquiries';
import { createInquiriesRouter } from '../routes/inquiries-router';
import { requireAuth } from '../middleware/auth';

test('회원 문의 실제 PostgreSQL 임시 테이블 + HTTP 통합', async t => {
  assert.ok(process.env.DATABASE_URL, '통합 검증용 DB 연결 설정이 필요합니다.');
  assert.ok(process.env.JWT_SECRET);
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('railway.internal') ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  t.after(async () => { await client.query('ROLLBACK'); await client.end(); });
  await client.query('BEGIN');
  // 임시 테이블이 기존 users를 가린다. 실제 회원/문의 행은 읽거나 변경하지 않는다.
  await client.query('CREATE TEMP TABLE users (id integer PRIMARY KEY, email text, full_name text, member_type text, is_deleted boolean DEFAULT false) ON COMMIT DROP');
  const migration = readFileSync('db/migrations/20260922_create_customer_inquiries.sql', 'utf8');
  await client.query(migration.replace('CREATE TABLE IF NOT EXISTS customer_inquiries', 'CREATE TEMP TABLE IF NOT EXISTS customer_inquiries'));
  await client.query(readFileSync('db/migrations/20260922_add_inquiry_read_revisions.sql', 'utf8'));
  const isolation = await client.query("SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid='customer_inquiries'::regclass");
  assert.match(isolation.rows[0].nspname, /^pg_temp_/);
  await client.query("INSERT INTO users(id,email,full_name,member_type,is_deleted) VALUES (1,'one@example.invalid','회원1','free',false),(2,'two@example.invalid','회원2','membership',false),(3,'admin@example.invalid','관리자','admin',false),(4,'hospital@example.invalid','병원','hospital_admin',false),(5,'deleted@example.invalid','탈퇴','superadmin',true),(6,'super@example.invalid','최고관리자','superadmin',false),(7,'old@example.invalid','권한변경','free',false)");
  const service = createInquiryService(drizzle(client, { schema }));
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  app.use('/api/inquiries', createInquiriesRouter(service, requireAuth));
  app.use('/api/admin/inquiries', createInquiriesRouter(service, requireAuth, true));
  const failedService: InquiryService = { ...service, findMember: async () => { throw new Error('private DB detail'); } };
  app.use('/failed-account', createInquiriesRouter(failedService, requireAuth));
  app.use('/failed-storage', createInquiriesRouter({ ...service, create: async () => { throw new Error('private SQL'); } }, requireAuth));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sign = (id: number, extra = {}, secret = process.env.JWT_SECRET!) => jwt.sign({ id, memberType: 'superadmin', ...extra }, secret, { expiresIn: '1h' });
  async function call(path: string, id: number | null = 1, method = 'GET', body?: unknown, token?: string) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(id === null ? {} : { Authorization: `Bearer ${token ?? sign(id)}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    return { status: res.status, body: await res.json() };
  }
  let inquiryId = 0;
  await t.test('미인증·위조·만료·탈퇴·없는 회원은 거부한다', async () => {
    assert.equal((await call('/api/inquiries', null)).status, 401);
    assert.equal((await call('/api/inquiries', 1, 'GET', undefined, sign(1, {}, 'wrong'))).status, 401);
    assert.equal((await call('/api/inquiries', 1, 'GET', undefined, jwt.sign({ id: 1, exp: 1 }, process.env.JWT_SECRET!))).status, 401);
    for (const id of [5, 999]) assert.equal((await call('/api/inquiries', id)).status, 401);
  });
  await t.test('사용자 지정 작성자·답변 삽입, 공백·길이 초과·잘못된 형식을 거부한다', async () => {
    for (const body of [{ title: ' ', content: '내용' }, { title: '제목', content: ' ' }, { title: 'x'.repeat(101), content: '내용' }, { title: '제목', content: 'x'.repeat(3001) }, { title: 1, content: '내용' }, { title: '제목', content: '내용', userId: 2 }, { title: '제목', content: '내용', answer: '위조' }, []]) {
      assert.equal((await call('/api/inquiries', 1, 'POST', body)).status, 400);
    }
    assert.equal((await client.query('SELECT count(*)::int AS n FROM customer_inquiries')).rows[0].n, 0);
  });
  await t.test('등록·본인 조회 응답에는 작성자 개인정보/관리자 ID가 없다', async () => {
    const created = await call('/api/inquiries', 1, 'POST', { title: ' 로그인 문의 ', content: '<script>alert(1)</script>\n문의 내용' });
    assert.equal(created.status, 201); assert.ok(inquiryDetailSchema.safeParse(created.body).success);
    inquiryId = created.body.id; assert.equal(created.body.title, '로그인 문의'); assert.equal(created.body.status, 'pending');
    for (const key of ['userId', 'password', 'answeredBy', 'author']) assert.equal(key in created.body, false);
    const result = await call(`/api/inquiries/${inquiryId}`); assert.equal(result.status, 200); assert.equal(result.body.content, created.body.content);
    const stored = await client.query('SELECT user_id FROM customer_inquiries WHERE id=$1', [inquiryId]); assert.equal(stored.rows[0].user_id, 1);
  });
  await t.test('타인 문의 접근은 없는 문의와 동일한 404이며 목록에도 섞이지 않는다', async () => {
    const other = await call(`/api/inquiries/${inquiryId}`, 2); const missing = await call('/api/inquiries/99999', 2);
    assert.equal(other.status, 404); assert.deepEqual(other, missing);
    const list = await call('/api/inquiries', 2); assert.equal(list.body.total, 0); assert.deepEqual(list.body.items, []);
  });
  await t.test('페이지·필터·ID 경계를 검증한다', async () => {
    for (const path of ['/api/inquiries?page=0','/api/inquiries?page=1.5','/api/inquiries?page=100001','/api/inquiries?limit=21','/api/inquiries?page=1&page=2','/api/inquiries/0','/api/inquiries/1abc','/api/inquiries/2147483648']) assert.equal((await call(path)).status, 400);
    assert.equal((await call('/api/admin/inquiries?status=invalid', 3)).status, 400);
  });
  await t.test('옛 JWT에 superadmin이 남아 있어도 현재 회원/병원관리자는 관리 API를 사용할 수 없다', async () => {
    for (const id of [1, 2, 4, 7]) {
      assert.equal((await call('/api/admin/inquiries', id)).status, 403);
      assert.equal((await call(`/api/admin/inquiries/${inquiryId}`, id)).status, 403);
      assert.equal((await call(`/api/admin/inquiries/${inquiryId}/answer`, id, 'PUT', { answer: '불가' })).status, 403);
    }
    assert.equal((await call('/api/admin/inquiries', 6)).status, 200);
  });
  await t.test('관리자 목록은 작성자 정보를 제공하며 답변 상태를 정확히 전환한다', async () => {
    const list = await call('/api/admin/inquiries', 3);
    assert.ok(inquiryListSchema.safeParse(list.body).success); assert.equal(list.body.items[0].author.email, 'one@example.invalid');
    for (const answer of ['', ' ', 'x'.repeat(3001)]) assert.equal((await call(`/api/admin/inquiries/${inquiryId}/answer`, 3, 'PUT', { answer })).status, 400);
    assert.equal((await call(`/api/admin/inquiries/${inquiryId}/answer`, 3, 'PUT', { answer: '내용', answeredBy: 6 })).status, 400);
    const answer = await call(`/api/admin/inquiries/${inquiryId}/answer`, 3, 'PUT', { answer: ' 수정되었습니다. ' });
    assert.equal(answer.status, 200); assert.equal(answer.body.answer, '수정되었습니다.'); assert.equal(answer.body.status, 'answered');
    assert.equal((await call('/api/admin/inquiries', 3)).body.total, 1);
    assert.equal((await call('/api/admin/inquiries?status=pending', 3)).body.total, 0);
    assert.equal((await call('/api/admin/inquiries?status=answered', 3)).body.total, 1);
    assert.equal((await call(`/api/inquiries/${inquiryId}`)).body.answer, '수정되었습니다.');
    assert.equal((await call('/api/admin/inquiries/99999/answer', 3, 'PUT', { answer: '내용' })).status, 404);
  });
  await t.test('답변 수정은 최초 답변일을 유지하고 수정자/수정일만 갱신한다', async () => {
    await client.query("UPDATE customer_inquiries SET answered_at=now()-interval '1 day',answer_updated_at=now()-interval '1 day' WHERE id=$1",[inquiryId]);
    const prior = await call(`/api/inquiries/${inquiryId}`);
    const changed = await call(`/api/admin/inquiries/${inquiryId}/answer`, 6, 'PUT', { answer: '추가 안내입니다.' });
    assert.equal(changed.body.answeredAt, prior.body.answeredAt); assert.ok(changed.body.answerUpdatedAt > changed.body.answeredAt);
    const row = await client.query('SELECT answered_by FROM customer_inquiries WHERE id=$1',[inquiryId]); assert.equal(row.rows[0].answered_by, 6);
  });
  await t.test('20개 페이지와 최신순·더 보기 경계, 문의 내용 미포함 목록을 검증한다', async () => {
    for (let i=0;i<22;i++) await service.create(1, { title: `문의 ${i}`, content: '내용' });
    const first = await call('/api/inquiries'); const second = await call('/api/inquiries?page=2');
    assert.equal(first.body.items.length,20); assert.equal(first.body.total,23); assert.equal(first.body.hasMore,true);
    assert.equal(second.body.items.length,3); assert.equal(second.body.hasMore,false);
    assert.equal(new Set([...first.body.items,...second.body.items].map(i=>i.id)).size,23);
    assert.ok(first.body.items[0].id>first.body.items[19].id); assert.equal('content' in first.body.items[0],false);
  });
  await t.test('미확인 답변 수는 본인만 조회하며 상세 GET은 읽음으로 변경하지 않는다', async () => {
    assert.equal((await call('/api/inquiries/unread-count', null)).status, 401);
    assert.equal((await call('/api/inquiries/unread-count')).body.unreadCount, 1);
    assert.equal((await call('/api/inquiries/unread-count', 2)).body.unreadCount, 0);
    const own = await call(`/api/inquiries/${inquiryId}`);
    assert.equal(own.body.isAnswerUnread, true); assert.equal(own.body.answerRevision, 2);
    await call(`/api/admin/inquiries/${inquiryId}`, 3);
    assert.equal((await call('/api/inquiries/unread-count')).body.unreadCount, 1);
  });
  await t.test('읽음은 본인만 가능하고 미래 버전/잘못된 요청을 거부한다', async () => {
    for (const id of [2, 3]) assert.equal((await call(`/api/inquiries/${inquiryId}/read`, id, 'PUT', { answerRevision: 2 })).status, 404);
    assert.equal((await call(`/api/inquiries/${inquiryId}/read`, 1, 'PUT', { answerRevision: 99 })).status, 404);
    for (const data of [{}, { answerRevision: 0 }, { answerRevision: '2' }, { answerRevision: 2, userId: 2 }]) assert.equal((await call(`/api/inquiries/${inquiryId}/read`, 1, 'PUT', data)).status, 400);
    const read = await call(`/api/inquiries/${inquiryId}/read`, 1, 'PUT', { answerRevision: 2 });
    assert.equal(read.status, 200); assert.equal(read.body.success, true);
    assert.equal((await call('/api/inquiries/unread-count')).body.unreadCount, 0);
    assert.equal((await call(`/api/inquiries/${inquiryId}`)).body.isAnswerUnread, false);
  });
  await t.test('답변 수정은 다시 미확인으로 표시하고 지연된 읽음은 새 답변을 읽지 않는다', async () => {
    await call(`/api/admin/inquiries/${inquiryId}/answer`, 3, 'PUT', { answer: '새로 수정된 답변' });
    assert.equal((await call('/api/inquiries/unread-count')).body.unreadCount, 1);
    await call(`/api/inquiries/${inquiryId}/read`, 1, 'PUT', { answerRevision: 2 });
    assert.equal((await call('/api/inquiries/unread-count')).body.unreadCount, 1);
    await call(`/api/inquiries/${inquiryId}/read`, 1, 'PUT', { answerRevision: 3 });
    await call(`/api/inquiries/${inquiryId}/read`, 1, 'PUT', { answerRevision: 2 });
    assert.equal((await call('/api/inquiries/unread-count')).body.unreadCount, 0);
    const pending = await service.create(2, { title: '대기', content: '내용' });
    assert.equal((await call(`/api/inquiries/${pending.id}/read`, 2, 'PUT', { answerRevision: 1 })).status, 404);
  });
  await t.test('병원 관리자도 일반 문의 작성은 가능하다', async () => {
    assert.equal((await call('/api/inquiries',4,'POST',{title:'병원 관리자 개인 문의',content:'내용'})).status,201);
    assert.equal((await call('/api/inquiries',4)).body.total,1);
  });
  await t.test('DB 제약으로 공백 내용·불완전 답변·존재하지 않는 회원을 차단한다', async () => {
    for (const sql of ["INSERT INTO customer_inquiries(user_id,title,content) VALUES(1,'','내용')", "INSERT INTO customer_inquiries(user_id,title,content,answer) VALUES(1,'제목','내용','답변')", "INSERT INTO customer_inquiries(user_id,title,content) VALUES(9999,'제목','내용')"]) {
      await client.query('SAVEPOINT bad_write');
      await assert.rejects(client.query(sql));
      await client.query('ROLLBACK TO SAVEPOINT bad_write');
    }
  });
  await t.test('DB 장애는 503 JSON이며 내부 SQL/연결 정보가 노출되지 않는다', async () => {
    for (const [path,method,body] of [['/failed-account','GET',undefined],['/failed-storage','POST',{title:'문의',content:'내용'}]] as const) {
      const result = await call(path,1,method,body); assert.equal(result.status,503); assert.doesNotMatch(JSON.stringify(result.body),/private/);
    }
  });
});
