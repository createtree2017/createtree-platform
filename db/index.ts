import "dotenv/config";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";


// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

// WebSocket 연결 안정성 개선
neonConfig.wsProxy = (host) => `${host}/v2`;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = "password";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 연결 풀 설정 개선
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // 최대 연결 수 증가 (10 → 20)
  idleTimeoutMillis: 30000,     // 유휴 타임아웃 증가 (10초 → 30초)
  connectionTimeoutMillis: 5000, // 연결 타임아웃 설정 (5초)
  maxUses: 10000,               // 연결 재사용 횟수 제한
});

// 연결 풀 에러 핸들링
pool.on('error', (err) => {
  console.error('데이터베이스 연결 풀 에러:', err);
  // 크리티컬한 에러가 아니면 앱이 크래시되지 않도록 처리
});

export const db = drizzle({ client: pool, schema });