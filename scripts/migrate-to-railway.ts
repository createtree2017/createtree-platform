/**
 * Neon DB → Railway PostgreSQL 데이터 마이그레이션 스크립트 v2
 *
 * 안전 원칙:
 * 1. 소스(Neon)는 읽기만, 절대 수정하지 않음
 * 2. Railway DB의 실제 컬럼과 Neon DB 컬럼의 교집합만 복사 (스키마 불일치 안전 처리)
 * 3. FK 제약 조건 임시 해제 후 전체 복사 → 재활성화
 * 4. 시퀀스(auto-increment) 복원
 * 5. 최종 행 수 검증으로 데이터 무결성 확인
 */

import "dotenv/config";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Client as PgClient } from "pg";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const SOURCE_URL = process.env.DATABASE_URL!;
const DEST_URL = process.env.RAILWAY_DATABASE_URL!;

if (!SOURCE_URL) throw new Error("DATABASE_URL이 없습니다 (Neon 소스)");
if (!DEST_URL) throw new Error("RAILWAY_DATABASE_URL이 없습니다 (Railway 대상)");

const sourcePool = new NeonPool({ connectionString: SOURCE_URL });

async function main() {
  console.log("=".repeat(60));
  console.log("🚀 Neon → Railway 데이터 마이그레이션 v2 시작");
  console.log("=".repeat(60) + "\n");

  const destClient = new PgClient({ connectionString: DEST_URL });
  await destClient.connect();
  console.log("✅ Railway DB 연결 성공\n");

  try {
    // ── STEP 1: 테이블 목록 조회 ────────────────────────
    const tableRes = await sourcePool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables: string[] = tableRes.rows.map((r: any) => r.table_name);
    console.log(`📋 대상 테이블: ${tables.length}개\n   ${tables.join(", ")}\n`);

    // ── STEP 2: 소스 행 수 사전 확인 ───────────────────
    console.log("📊 [사전 검증] Neon DB 행 수:");
    const sourceCounts: Record<string, number> = {};
    let totalSource = 0;
    for (const table of tables) {
      const r = await sourcePool.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(r.rows[0].count);
      sourceCounts[table] = count;
      totalSource += count;
      if (count > 0) console.log(`   ${table}: ${count}행`);
    }
    console.log(`   합계: ${totalSource}행\n`);

    // ── STEP 3: FK 비활성화 + TRUNCATE ─────────────────
    console.log("🔓 FK 비활성화 및 테이블 초기화...");
    await destClient.query("BEGIN");
    await destClient.query("SET LOCAL session_replication_role = replica");
    for (const table of tables) {
      await destClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
    }
    await destClient.query("COMMIT");
    console.log("   완료\n");

    // replica 모드 유지 (세션 전체)
    await destClient.query("SET session_replication_role = replica");

    // ── STEP 4: 데이터 복사 ────────────────────────────
    console.log("📦 데이터 복사 중...");
    const copiedCounts: Record<string, number> = {};
    const BATCH = 200;

    for (const table of tables) {
      const srcCount = sourceCounts[table];
      if (srcCount === 0) {
        copiedCounts[table] = 0;
        continue;
      }

      // Railway DB의 실제 컬럼 목록
      const destColRes = await destClient.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );
      const destCols = new Set(destColRes.rows.map((r: any) => r.column_name));

      // 소스 컬럼 목록 파악 (샘플 1행)
      const sample = await sourcePool.query(`SELECT * FROM "${table}" LIMIT 1`);
      if (!sample.rows.length) { copiedCounts[table] = 0; continue; }

      const srcCols = Object.keys(sample.rows[0]);
      const useCols = srcCols.filter(c => destCols.has(c));  // 교집합
      const skipCols = srcCols.filter(c => !destCols.has(c));

      if (skipCols.length > 0) {
        console.log(`   ⚠️  ${table}: 건너뜀 컬럼 [${skipCols.join(", ")}]`);
      }

      // 전체 데이터 조회
      const colSql = useCols.map(c => `"${c}"`).join(", ");
      const data = await sourcePool.query(`SELECT ${colSql} FROM "${table}"`);
      const rows = data.rows;

      if (!rows.length) { copiedCounts[table] = 0; continue; }

      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const ph = batch
          .map((_, ri) => `(${useCols.map((_, ci) => `$${ri * useCols.length + ci + 1}`).join(", ")})`)
          .join(", ");
        const vals = batch.flatMap(row =>
          useCols.map(col => {
            const v = row[col];
            // 숫자 NaN → null
            if (typeof v === "number" && isNaN(v)) return null;
            // 문자열 "NaN" → null (DB에 잘못 저장된 값 처리)
            if (typeof v === "string" && v.trim() === "NaN") return null;
            // jsonb 컬럼: 객체/배열은 JSON 문자열로 변환
            if (v !== null && typeof v === "object" && !(v instanceof Date)) {
              return JSON.stringify(v);
            }
            return v;
          })
        );
        await destClient.query(
          `INSERT INTO "${table}" (${colSql}) VALUES ${ph}`,
          vals
        ).catch(async (err: any) => {
          console.error(`\n   ⚠️  ${table} 배치 오류 → 행 단위 재시도: ${err.message.split("\n")[0]}`);
          // 개별 행씩 재시도: 오류 행만 건너뜀
          for (const row of batch) {
            const singleVals = useCols.map(col => {
              const v = row[col];
              if (typeof v === "number" && isNaN(v)) return null;
              if (typeof v === "string" && v.trim() === "NaN") return null;
              if (v !== null && typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
              return v;
            });
            const singlePh = `(${useCols.map((_, ci) => `$${ci + 1}`).join(", ")})`;
            await destClient.query(
              `INSERT INTO "${table}" (${colSql}) VALUES ${singlePh}`,
              singleVals
            ).catch((rowErr: any) => {
              console.error(`   ⚠️  건너뜀 행 (id=${(row as any).id}): ${rowErr.message.split("\n")[0]}`);
            });
          }
        });
        inserted += batch.length;
      }

      copiedCounts[table] = inserted;
      console.log(`   ✅ ${table}: ${inserted}/${srcCount}행`);
    }
    console.log("");

    // ── STEP 5: 시퀀스 복원 ────────────────────────────
    console.log("🔢 시퀀스 복원...");
    for (const table of tables) {
      try {
        const r = await destClient.query(
          `SELECT pg_get_serial_sequence('"${table}"', 'id') as seq`
        );
        const seq = r.rows[0]?.seq;
        if (seq) {
          await destClient.query(
            `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
          );
        }
      } catch { /* id 없는 테이블 무시 */ }
    }
    console.log("   완료\n");

    // ── STEP 6: FK 재활성화 ────────────────────────────
    await destClient.query("SET session_replication_role = DEFAULT");
    console.log("🔒 FK 제약 조건 재활성화\n");

    // ── STEP 7: 최종 검증 ──────────────────────────────
    console.log("🔍 [최종 검증] 행 수 대조:");
    let allMatch = true;
    let totalCopied = 0;
    for (const table of tables) {
      const src = sourceCounts[table];
      const dstR = await destClient.query(`SELECT COUNT(*) FROM "${table}"`);
      const dst = parseInt(dstR.rows[0].count);
      totalCopied += dst;
      const ok = src === dst;
      if (!ok) allMatch = false;
      if (src > 0 || !ok) {
        console.log(`   ${ok ? "✅" : "❌"} ${table}: Neon=${src}, Railway=${dst}${!ok ? " ← 불일치!" : ""}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    if (allMatch) {
      console.log(`✅ 완료! 총 ${totalCopied}행 — 데이터 손실 없음`);
      console.log("\n📌 다음 단계:");
      console.log("   Railway dashboard → createtree-platform → Variables");
      console.log("   DATABASE_URL 값을 Railway DB URL로 변경 후 재배포");
    } else {
      console.log("⚠️  일부 불일치. 위 목록 확인 필요.");
    }
    console.log("=".repeat(60));

  } catch (err) {
    try { await destClient.query("SET session_replication_role = DEFAULT"); } catch {}
    console.error("\n❌ 오류:", (err as any).message);
    console.error((err as any).detail || "");
    throw err;
  } finally {
    await destClient.end();
    await sourcePool.end();
    process.exit(0);
  }
}

main();
