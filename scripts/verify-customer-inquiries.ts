import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { inquiryRouter, adminInquiryRouter } from '../server/routes/inquiries';
import { inquiryListSchema } from '../shared/inquiries';

// 새 프로세스의 실제 라우터/인증/DB 연결을 검증한다. GET만 사용하고 문의를 작성하지 않는다.
async function main() {
  const app = express();
  app.use(cookieParser());
  app.use('/api/inquiries', inquiryRouter);
  app.use('/api/admin/inquiries', adminInquiryRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const anonymous = await fetch(`${origin}/api/inquiries`);
    assert.equal(anonymous.status, 401);
    const members = await pool.query("SELECT id,member_type FROM users WHERE member_type IN ('superadmin','free') AND is_deleted IS NOT TRUE ORDER BY id");
    const admin = members.rows.find(row => row.member_type === 'superadmin');
    const member = members.rows.find(row => row.member_type === 'free');
    assert.ok(admin && member && process.env.JWT_SECRET, '검증할 정상 회원/관리자와 JWT 설정이 필요합니다.');
    const cookie = (id: number) => `auth_token=${jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: 60 })}`;
    for (const [path, id] of [['/api/inquiries', member.id], ['/api/admin/inquiries', admin.id]] as const) {
      const res = await fetch(origin + path, { headers: { Cookie: cookie(id) } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.ok(inquiryListSchema.safeParse(await res.json()).success);
    }
    const denied = await fetch(`${origin}/api/admin/inquiries`, { headers: { Cookie: cookie(member.id) } });
    assert.equal(denied.status, 403);
    console.log('실제 라우터 + JWT 쿠키 + DB 조회 검증 통과 (무인증 401, 본인/관리자 목록 200 JSON, 일반회원 관리접근 403).');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
}
main().catch(error => { console.error('문의 읽기 검증 실패', { code: (error as { code?: string }).code }); process.exitCode = 1; });
