import "dotenv/config";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new NeonPool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  try {
    // user_settings의 모든 컬럼과 데이터 타입 확인
    const r = await pool.query(`SELECT * FROM "user_settings" LIMIT 5`);
    if (r.rows.length > 0) {
      console.log("컬럼 목록:", Object.keys(r.rows[0]));
      for (const row of r.rows) {
        for (const [key, val] of Object.entries(row)) {
          if (typeof val === "number" && isNaN(val as number)) {
            console.log(`NaN 발견: 컬럼=${key}, 행 ID=${(row as any).id}`);
          }
        }
      }
    }
    // 전체 데이터 출력
    const all = await pool.query(`SELECT * FROM "user_settings"`);
    for (const row of all.rows) {
      for (const [key, val] of Object.entries(row)) {
        if (val === null) continue;
        if (typeof val === "string" && val.trim() === "NaN") {
          console.log(`문자열 NaN 발견: 컬럼=${key}, 행 ID=${(row as any).id}, 값=${val}`);
        }
        if (typeof val === "number" && isNaN(val as number)) {
          console.log(`숫자 NaN 발견: 컬럼=${key}, 행 ID=${(row as any).id}`);
        }
      }
    }
    console.log("검사 완료. 위에 NaN 없으면 정상 데이터");
  } catch (e) {
    console.error("오류:", (e as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
main();
