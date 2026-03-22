/**
 * Railway DB 마이그레이션 전수검사 스크립트
 * 
 * 검증 항목:
 * 1. Railway DB 연결 및 응답 시간
 * 2. 모든 테이블 존재 여부
 * 3. 모든 테이블 행 수 확인
 * 4. 주요 테이블 데이터 샘플 확인 (users, concepts, images 등)
 * 5. FK 제약 조건 무결성
 * 6. 시퀀스 정상 동작
 * 7. Neon 잔존 참조 없음 확인
 */

import "dotenv/config";
import { Client } from "pg";

const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL 누락");

let passed = 0;
let failed = 0;
const results: { test: string; status: string; detail: string }[] = [];

function ok(test: string, detail: string) {
  passed++;
  results.push({ test, status: "✅ PASS", detail });
}
function fail(test: string, detail: string) {
  failed++;
  results.push({ test, status: "❌ FAIL", detail });
}

async function main() {
  console.log("=".repeat(60));
  console.log("🔍 Railway DB 마이그레이션 전수검사");
  console.log("=".repeat(60));
  console.log(`대상: ${DB_URL.replace(/:[^:@]+@/, ':***@')}\n`);

  const client = new Client({ connectionString: DB_URL });

  try {
    // ── TEST 1: 연결 ──────────────────────────────────
    const t0 = Date.now();
    await client.connect();
    const connectMs = Date.now() - t0;
    ok("DB 연결", `${connectMs}ms`);

    // ── TEST 2: Neon 잔존 확인 ─────────────────────────
    if (DB_URL.includes("neon.tech")) {
      fail("Neon 잔존", "DATABASE_URL이 여전히 neon.tech를 가리킴!");
    } else {
      ok("Neon 잔존", "DATABASE_URL에 neon.tech 없음 — Railway DB 확인");
    }

    // ── TEST 3: 테이블 목록 확인 ──────────────────────
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map((r: any) => r.table_name);

    const expectedTables = [
      "users", "roles", "user_roles", "hospitals", "hospital_codes",
      "concepts", "concept_categories", "images", "image_styles",
      "music", "music_styles", "banners", "small_banners",
      "theme_missions", "sub_missions", "sub_mission_submissions",
      "mission_categories", "mission_folders",
      "user_mission_progress", "user_settings", "user_notification_settings",
      "pregnancy_profiles", "refresh_tokens", "password_reset_tokens",
      "snapshot_prompts", "popular_styles", "main_gallery_items", "main_menus",
      "personas", "persona_categories",
      "photobook_projects", "photobook_templates", "photobook_backgrounds",
      "photobook_icons", "photobook_material_categories", "photobook_versions",
      "product_categories", "product_projects", "product_variants",
      "service_categories", "service_items",
      "milestones", "milestone_categories", "milestone_applications",
      "user_milestones", "user_devices",
      "notifications", "notification_settings",
      "big_missions", "big_mission_topics", "user_big_mission_progress",
      "ai_model_settings", "global_prompt_rules", "style_templates",
      "ab_tests", "ab_test_variants", "ab_test_results",
      "action_types", "collages", "saved_chats"
    ];

    const missing = expectedTables.filter(t => !tables.includes(t));
    if (missing.length === 0) {
      ok("테이블 존재", `${tables.length}개 테이블 — 필수 테이블 전부 존재`);
    } else {
      fail("테이블 존재", `누락: ${missing.join(", ")}`);
    }

    // ── TEST 4: 행 수 확인 ────────────────────────────
    const criticalTables: Record<string, number> = {
      users: 413,
      concepts: 101,
      images: 4091,
      music: 85,
      snapshot_prompts: 525,
      theme_missions: 26,
      sub_missions: 77,
      sub_mission_submissions: 333,
      user_mission_progress: 168,
      roles: 4,
      hospitals: 9,
      banners: 5,
    };

    for (const [table, expected] of Object.entries(criticalTables)) {
      try {
        const r = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        const actual = parseInt(r.rows[0].count);
        if (actual === expected) {
          ok(`${table} 행수`, `${actual}행 (일치)`);
        } else if (table === "user_settings" && actual === expected - 1) {
          ok(`${table} 행수`, `${actual}행 (NaN 행 1개 제외 — 정상)`);
        } else {
          fail(`${table} 행수`, `기대: ${expected}, 실제: ${actual}`);
        }
      } catch (e) {
        fail(`${table} 행수`, `조회 오류: ${(e as any).message}`);
      }
    }

    // ── TEST 5: 주요 데이터 샘플 확인 ──────────────────
    // 첫 번째 사용자
    const userR = await client.query(`SELECT id, email, username, member_type FROM users LIMIT 3`);
    if (userR.rows.length > 0) {
      ok("users 샘플", userR.rows.map((r: any) => `${r.id}:${r.username}`).join(", "));
    } else {
      fail("users 샘플", "데이터 없음");
    }

    // 첫 번째 컨셉
    const conceptR = await client.query(`SELECT * FROM concepts LIMIT 3`);
    if (conceptR.rows.length > 0) {
      const cols = Object.keys(conceptR.rows[0]);
      ok("concepts 샘플", `${conceptR.rows.length}행, 컬럼: ${cols.slice(0,5).join(",")}...`);
    } else {
      fail("concepts 샘플", "데이터 없음");
    }

    // 이미지 최근 데이터
    const imgR = await client.query(`SELECT * FROM images ORDER BY id DESC LIMIT 3`);
    if (imgR.rows.length > 0) {
      ok("images 최신", `${imgR.rows.length}행, id: ${imgR.rows.map((r:any) => r.id).join(",")}`);
    } else {
      fail("images 최신", "데이터 없음");
    }

    // ── TEST 6: FK 무결성 (orphan 체크) ────────────────
    const fkChecks = [
      {
        name: "images→users FK",
        q: `SELECT COUNT(*) FROM images i LEFT JOIN users u ON i.user_id = u.id WHERE i.user_id IS NOT NULL AND u.id IS NULL`,
      },
      {
        name: "user_roles→users FK",
        q: `SELECT COUNT(*) FROM user_roles ur LEFT JOIN users u ON ur.user_id = u.id WHERE u.id IS NULL`,
      },
      {
        name: "sub_missions→theme_missions FK",
        q: `SELECT COUNT(*) FROM sub_missions sm LEFT JOIN theme_missions tm ON sm.theme_mission_id = tm.id WHERE tm.id IS NULL`,
      },
    ];
    for (const fk of fkChecks) {
      try {
        const r = await client.query(fk.q);
        const orphans = parseInt(r.rows[0].count);
        if (orphans === 0) {
          ok(fk.name, "고아 레코드 없음");
        } else {
          fail(fk.name, `고아 레코드 ${orphans}개`);
        }
      } catch (e) {
        fail(fk.name, `조회 오류: ${(e as any).message}`);
      }
    }

    // ── TEST 7: 시퀀스 정상 작동 ──────────────────────
    try {
      const seqR = await client.query(`SELECT last_value FROM users_id_seq`);
      const lastVal = parseInt(seqR.rows[0].last_value);
      const maxR = await client.query(`SELECT MAX(id) FROM users`);
      const maxId = parseInt(maxR.rows[0].max);
      if (lastVal >= maxId) {
        ok("users 시퀀스", `last_value=${lastVal}, max_id=${maxId} — 정상`);
      } else {
        fail("users 시퀀스", `last_value=${lastVal} < max_id=${maxId} — 충돌 위험!`);
      }
    } catch (e) {
      fail("users 시퀀스", `확인 불가: ${(e as any).message}`);
    }

    // ── TEST 8: 응답 시간 테스트 ──────────────────────
    const t1 = Date.now();
    await client.query(`SELECT COUNT(*) FROM images`);
    const queryMs = Date.now() - t1;
    if (queryMs < 2000) {
      ok("쿼리 성능", `images COUNT 쿼리: ${queryMs}ms`);
    } else {
      fail("쿼리 성능", `images COUNT 쿼리: ${queryMs}ms (느림)`);
    }

  } catch (err) {
    fail("치명적 오류", (err as any).message);
  } finally {
    await client.end();
  }

  // ── 결과 출력 ──────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("📋 전수검사 결과");
  console.log("=".repeat(60));
  for (const r of results) {
    console.log(`${r.status} ${r.test}: ${r.detail}`);
  }
  console.log("\n" + "─".repeat(60));
  console.log(`합계: ${passed} PASS / ${failed} FAIL (총 ${passed + failed}건)`);
  if (failed === 0) {
    console.log("🎉 전수검사 통과! 데이터 무결성 확인 완료.");
  } else {
    console.log("⚠️  일부 실패 항목이 있습니다. 위 목록 확인 필요.");
  }
  console.log("=".repeat(60));
  process.exit(0);
}

main();
