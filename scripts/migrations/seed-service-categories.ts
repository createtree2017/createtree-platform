import { db } from "../../db";
import * as schema from "../../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    console.log("🌱 서비스 카테고리 및 하위 항목 시드 데이터 생성 시작...");
    
    // 1. 메인 카테고리 정의
    const defaultCategories = [
      {
        categoryId: "image",
        title: "AI 이미지 만들기",
        icon: "image",
        isPublic: true,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        categoryId: "music",
        title: "AI 노래 만들기",
        icon: "music",
        isPublic: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        categoryId: "chat",
        title: "AI 친구 만들기",
        icon: "message-circle",
        isPublic: true,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        categoryId: "milestone",
        title: "마일스톤",
        icon: "award",
        isPublic: true,
        order: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // 2. 각 카테고리에 대해 존재하는지 확인하고 없으면 추가
    const categoryIdMap = new Map<string, number>(); // categoryId -> id 매핑
    
    for (const category of defaultCategories) {
      const existing = await db.query.serviceCategories.findFirst({
        where: eq(schema.serviceCategories.categoryId, category.categoryId)
      });
      
      if (!existing) {
        const [newCategory] = await db.insert(schema.serviceCategories)
          .values(category)
          .returning();
        
        console.log(`✅ 카테고리 추가됨: ${category.title} (${category.categoryId})`);
        categoryIdMap.set(category.categoryId, newCategory.id);
      } else {
        console.log(`🔄 카테고리 이미 존재함: ${category.title} (${category.categoryId})`);
        categoryIdMap.set(category.categoryId, existing.id);
      }
    }
    
    // 3. 하위 서비스 항목 정의
    const serviceItems = [
      // 이미지 카테고리 하위 항목
      {
        itemId: "maternity-photo",
        title: "만삭사진 만들기",
        description: "AI로 아름다운 만삭 사진을 생성합니다.",
        icon: "baby",
        categoryId: categoryIdMap.get("image")!,
        isPublic: true,
        order: 0
      },
      {
        itemId: "family-photo",
        title: "가족사진 만들기",
        description: "AI로 멋진 가족 사진을 생성합니다.",
        icon: "users",
        categoryId: categoryIdMap.get("image")!,
        isPublic: true,
        order: 1
      },
      {
        itemId: "stickers",
        title: "스티커 만들기",
        description: "내 아이 사진으로 귀여운 스티커를 만듭니다.",
        icon: "sticker",
        categoryId: categoryIdMap.get("image")!,
        isPublic: true,
        order: 2
      },
      
      // 노래 카테고리 하위 항목
      {
        itemId: "lullaby",
        title: "자장가 만들기",
        description: "아이를 위한 맞춤형 자장가를 생성합니다.",
        icon: "music-2",
        categoryId: categoryIdMap.get("music")!,
        isPublic: true,
        order: 0
      },
      {
        itemId: "pregnancy-music",
        title: "태교 음악 만들기",
        description: "태아의 두뇌 발달에 좋은 태교 음악을 생성합니다.",
        icon: "heart-pulse",
        categoryId: categoryIdMap.get("music")!,
        isPublic: true,
        order: 1
      },
      
      // 챗 카테고리 하위 항목
      {
        itemId: "mommy-chat",
        title: "엄마 도우미 채팅",
        description: "육아 및 임신 관련 질문에 답변해 드립니다.",
        icon: "message-square-text",
        categoryId: categoryIdMap.get("chat")!,
        isPublic: true,
        order: 0
      },
      {
        itemId: "doctor-chat",
        title: "AI 의사 상담",
        description: "건강 관련 질문에 AI가 상담해 드립니다.",
        icon: "stethoscope",
        categoryId: categoryIdMap.get("chat")!,
        isPublic: true,
        order: 1
      }
    ];
    
    // 4. 각 서비스 항목 추가
    for (const item of serviceItems) {
      const existing = await db.query.serviceItems.findFirst({
        where: eq(schema.serviceItems.itemId, item.itemId)
      });
      
      if (!existing) {
        await db.insert(schema.serviceItems).values({
          ...item,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ 서비스 항목 추가됨: ${item.title} (${item.itemId})`);
      } else {
        console.log(`🔄 서비스 항목 이미 존재함: ${item.title} (${item.itemId})`);
      }
    }
    
    console.log("🌱 서비스 카테고리 및 하위 항목 시드 데이터 생성 완료!");
  } catch (error) {
    console.error("❌ 시드 데이터 생성 오류:", error);
  }
}

main().then(() => process.exit(0));