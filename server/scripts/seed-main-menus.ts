/**
 * main_menus 테이블 생성 + 초기 seed 데이터 스크립트
 * 
 * 실행: npx tsx server/scripts/seed-main-menus.ts
 * 
 * - main_menus 테이블이 없으면 생성
 * - service_items에 main_menu_id 컬럼이 없으면 추가
 * - 5개 초기 메인 메뉴 seed 데이터 삽입 (중복 방지)
 */

import { db } from "@db";
import { sql } from "drizzle-orm";
import { mainMenus } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function seedMainMenus() {
    console.log("🚀 main_menus 마이그레이션 + seed 시작...\n");

    // 1. main_menus 테이블 생성 (IF NOT EXISTS)
    console.log("📋 Step 1: main_menus 테이블 생성...");
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS main_menus (
      id SERIAL PRIMARY KEY,
      menu_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      icon TEXT NOT NULL,
      path TEXT NOT NULL,
      home_type TEXT NOT NULL DEFAULT 'dedicated',
      home_submenu_path TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
    console.log("  ✅ main_menus 테이블 준비 완료\n");

    // 2. service_items에 main_menu_id 컬럼 추가 (IF NOT EXISTS)
    console.log("📋 Step 2: service_items.main_menu_id 컬럼 추가...");
    await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_items' AND column_name = 'main_menu_id'
      ) THEN
        ALTER TABLE service_items ADD COLUMN main_menu_id INTEGER REFERENCES main_menus(id);
      END IF;
    END $$;
  `);
    console.log("  ✅ service_items.main_menu_id 컬럼 준비 완료\n");

    // 3. 초기 seed 데이터 삽입
    console.log("📋 Step 3: 초기 메뉴 데이터 삽입...");

    const initialMenus = [
        { menuId: 'my-missions', title: '나의미션', icon: 'Trophy', path: '/mymissions', isActive: false, order: 0 },
        { menuId: 'culture-center', title: '문화센터', icon: 'Target', path: '/missions', isActive: true, order: 1 },
        { menuId: 'ai-create', title: 'AI 생성', icon: 'Sparkles', path: '/', isActive: true, order: 2 },
        { menuId: 'gallery', title: '갤러리', icon: 'Images', path: '/gallery', isActive: true, order: 3 },
        { menuId: 'my-page', title: 'MY', icon: 'User', path: '/profile', isActive: true, order: 4 },
    ];

    for (const menu of initialMenus) {
        // 중복 방지 — menuId로 확인
        const existing = await db.select().from(mainMenus).where(eq(mainMenus.menuId, menu.menuId));
        if (existing.length > 0) {
            console.log(`  ⏭️  "${menu.title}" (${menu.menuId}) — 이미 존재, 건너뜀`);
            continue;
        }

        await db.insert(mainMenus).values({
            menuId: menu.menuId,
            title: menu.title,
            icon: menu.icon,
            path: menu.path,
            homeType: 'dedicated',
            isActive: menu.isActive,
            order: menu.order,
        });
        console.log(`  ✅ "${menu.title}" (${menu.menuId}) — 삽입 완료`);
    }

    // 4. 결과 확인
    console.log("\n📋 Step 4: 최종 결과 확인...");
    const allMenus = await db.select().from(mainMenus);
    console.log(`  총 ${allMenus.length}개 메인 메뉴:`);
    for (const m of allMenus) {
        console.log(`    [${m.order}] ${m.isActive ? '🟢' : '🔴'} ${m.title} (${m.menuId}) → ${m.path}`);
    }

    console.log("\n🎉 main_menus 마이그레이션 + seed 완료!");
    process.exit(0);
}

seedMainMenus().catch((err) => {
    console.error("❌ 오류 발생:", err);
    process.exit(1);
});
