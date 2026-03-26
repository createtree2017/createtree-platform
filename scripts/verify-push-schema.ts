import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    // 1. users 테이블에 컬럼 추가
    const addUserCols = [
      { col: "is_system_push_agreed", sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_push_agreed BOOLEAN DEFAULT true" },
      { col: "is_marketing_push_agreed", sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_marketing_push_agreed BOOLEAN DEFAULT false" },
    ];
    for (const c of addUserCols) {
      await pool.query(c.sql);
      console.log(`✅ users.${c.col} 추가 완료`);
    }

    // 2. notifications 테이블에 컬럼 추가
    const addNotifCols = [
      { col: "action_url", sql: "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT" },
      { col: "image_url", sql: "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT" },
    ];
    for (const c of addNotifCols) {
      await pool.query(c.sql);
      console.log(`✅ notifications.${c.col} 추가 완료`);
    }

    // 3. 전체확인
    const result = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE (table_name = 'users' AND column_name IN ('is_system_push_agreed', 'is_marketing_push_agreed'))
         OR (table_name = 'notifications' AND column_name IN ('action_url', 'image_url'))
         OR (table_name = 'push_delivery_logs')
      ORDER BY table_name, column_name;
    `);

    console.log("\n📋 최종 확인:");
    result.rows.forEach((r: any) => console.log(`  ✅ ${r.table_name}.${r.column_name}`));
    console.log(`\n총 ${result.rows.length}개 컬럼/테이블 확인됨`);

  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
