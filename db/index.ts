import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 연결 풀 설정 (기존 Neon 설정과 동일한 값 유지)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // 최대 연결 수
  idleTimeoutMillis: 30000,     // 유휴 타임아웃 (30초)
  connectionTimeoutMillis: 5000, // 연결 타임아웃 (5초)
  // SSL: Railway 내부 연결 시에는 불필요, 외부 연결 시에는 필요할 수 있음
  ssl: process.env.DATABASE_URL.includes('.neon.tech')
    ? { rejectUnauthorized: false }
    : process.env.DATABASE_URL.includes('railway.internal')
      ? false
      : { rejectUnauthorized: false },
});

// 연결 풀 에러 핸들링
pool.on('error', (err) => {
  console.error('데이터베이스 연결 풀 에러:', err);
  // 크리티컬한 에러가 아니면 앱이 크래시되지 않도록 처리
});

export const db = drizzle({ client: pool, schema });