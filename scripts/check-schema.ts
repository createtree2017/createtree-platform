import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const res = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='notifications' ORDER BY ordinal_position`
    );
    console.log("=== notifications 테이블 스키마 ===");
    res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    // 기존 데이터의 user_id 타입 확인
    const sample = await pool.query(`SELECT user_id, pg_typeof(user_id) as type FROM notifications LIMIT 1`);
    if (sample.rows.length > 0) {
      console.log(`\n기존 데이터 user_id 타입: ${sample.rows[0].type}, 값: ${sample.rows[0].user_id}`);
    }
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
