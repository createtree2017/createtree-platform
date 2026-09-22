import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';

// 이 기능의 추가 SQL만 실행한다. 기본 실행은 읽기 전용 확인, --apply일 때 적용한다.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL이 필요합니다.');
  const client = new Client({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway.internal') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  try {
    const apply = process.argv.includes('--apply');
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    await client.query("SET LOCAL search_path TO public, pg_catalog");
    await client.query("SET LOCAL lock_timeout = '5s'");
    if (apply) {
      await client.query("SELECT pg_advisory_xact_lock(20260922, 1)");
      await client.query(readFileSync('db/migrations/20260922_create_customer_inquiries.sql', 'utf8'));
      await client.query(readFileSync('db/migrations/20260922_add_inquiry_read_revisions.sql', 'utf8'));
    }
    const columns = await client.query("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_inquiries' ORDER BY ordinal_position");
    if (!columns.rowCount) {
      console.log('문의 테이블 미반영. --apply로 검증된 추가 migration을 적용할 수 있습니다.');
    } else {
      const expected = ['id','user_id','title','content','answer','answered_by','answered_at','answer_updated_at','created_at','answer_revision','read_answer_revision'];
      if (columns.rows.map(c => c.column_name).join(',') !== expected.join(',')) throw new Error('문의 테이블 컬럼 불일치');
      for (const column of columns.rows.filter(c => c.column_name.endsWith('_at'))) {
        if (column.data_type !== 'timestamp with time zone') throw new Error('문의 시간 컬럼 타입 불일치');
      }
      const constraints = await client.query("SELECT conname FROM pg_constraint WHERE conrelid='public.customer_inquiries'::regclass");
      if (!['customer_inquiries_title_check','customer_inquiries_content_check','customer_inquiries_answer_check','customer_inquiries_revision_check'].every(name => constraints.rows.some(c => c.conname === name))) throw new Error('문의 CHECK 제약 불일치');
      const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='customer_inquiries'");
      if (!['customer_inquiries_user_created_idx','customer_inquiries_created_idx','customer_inquiries_pending_idx','customer_inquiries_unread_idx'].every(name => indexes.rows.some(i => i.indexname === name))) throw new Error('문의 인덱스 불일치');
      console.log(JSON.stringify({ applied: apply, columns: columns.rowCount, constraints: constraints.rowCount, indexes: indexes.rowCount }));
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    // 접속 문자열이나 SQL 파라미터는 출력하지 않는다.
    console.error('문의 migration 검증/적용 실패', { code: (error as { code?: string }).code });
    process.exitCode = 1;
  } finally { await client.end(); }
}
main().catch(() => { console.error('문의 migration DB 연결 실패'); process.exitCode = 1; });
