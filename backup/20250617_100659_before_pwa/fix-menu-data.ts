/**
 * 메뉴 데이터 수정 및 path 필드 추가
 * 기존 service_items에 누락된 path 필드를 추가하고 샘플 데이터 생성
 */

import { db } from "./db/index";
import { serviceItems, serviceCategories } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixMenuData() {
  try {
    console.log("🔧 메뉴 데이터 수정 시작...");

    // 1. 기존 service_items에 path 필드 추가 (DB 스키마 변경 후 실행)
    const existingItems = await db.select().from(serviceItems);
    
    for (const item of existingItems) {
      if (!item.path) {
        // itemId를 기반으로 path 생성
        const generatedPath = `/${item.itemId}`;
        
        await db
          .update(serviceItems)
          .set({ path: generatedPath })
          .where(eq(serviceItems.id, item.id));
        
        console.log(`✅ 항목 ${item.title}에 path ${generatedPath} 추가`);
      }
    }

    // 2. 새로 추가된 카테고리들 확인
    const categories = await db.select().from(serviceCategories);
    console.log("📋 현재 카테고리 목록:");
    for (const category of categories) {
      console.log(`- ${category.title} (ID: ${category.id}, 공개: ${category.isPublic})`);
      
      // 각 카테고리의 하위 항목 확인
      const items = await db.select()
        .from(serviceItems)
        .where(eq(serviceItems.categoryId, category.id));
      
      console.log(`  하위 항목 ${items.length}개:`);
      for (const item of items) {
        console.log(`    - ${item.title} (${item.path || '경로 없음'})`);
      }
    }

    console.log("✅ 메뉴 데이터 수정 완료");
  } catch (error) {
    console.error("❌ 메뉴 데이터 수정 실패:", error);
  }
}

fixMenuData();