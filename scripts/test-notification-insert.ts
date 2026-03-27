import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    // userId=10 (송기우)에게 테스트 알림 직접 INSERT
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at) 
       VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *`,
      ["10", "admin_push", "테스트 알림", "이것은 DB 직접 INSERT 테스트입니다."]
    );
    console.log("✅ INSERT 성공:", result.rows[0]);
    
    // 확인
    const check = await pool.query(
      `SELECT id, user_id, type, title FROM notifications WHERE user_id = '10' ORDER BY created_at DESC`
    );
    console.log(`\nuserId=10의 알림 총 ${check.rowCount}건:`);
    check.rows.forEach(r => console.log(`  [${r.id}] ${r.type}: ${r.title}`));
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
