import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log("DB 확인 중...");
    
    // description 컬럼이 존재하는지 확인
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'main_menus' AND column_name = 'description';
    `);

    if (checkRes.rows.length === 0) {
      console.log("'description' 컬럼이 없습니다. 추가합니다...");
      await pool.query(`ALTER TABLE "main_menus" ADD COLUMN "description" text;`);
      console.log("✅ 'description' 컬럼 성공적으로 추가 완료!");
    } else {
      console.log("✅ 'description' 컬럼이 이미 존재합니다.");
    }
  } catch (err: any) {
    console.error("❌ DB 에러:", err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
