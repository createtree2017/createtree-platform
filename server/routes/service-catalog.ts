import { Router } from "express";
import { db } from "../../db/index";
import { serviceCategories, serviceItems } from "../../shared/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// 통합 메뉴 API - 카테고리와 서비스 항목을 함께 제공
router.get("/menu", async (req, res) => {
  try {
    // 1. 활성화된 서비스 카테고리 가져오기 (공개 상태인 것만)
    const categories = await db.select().from(serviceCategories)
      .where(eq(serviceCategories.isPublic, true))
      .orderBy(serviceCategories.order);

    if (!categories || categories.length === 0) {
      return res.status(200).json([]);
    }

    // 2. 메뉴 구조 생성
    const menu = [];

    // 3. 각 카테고리별로 해당하는 서비스 항목 조회
    for (const category of categories) {
      // 해당 카테고리에 속한 활성화된 서비스 항목만 가져오기
      const items = await db.select({
        id: serviceItems.id,
        title: serviceItems.title,
        path: serviceItems.path,
        iconName: serviceItems.icon
      }).from(serviceItems)
        .where(and(
          eq(serviceItems.categoryId, category.id),
          eq(serviceItems.isPublic, true)
        ))
        .orderBy(serviceItems.order);

      // 항목이 있는 카테고리만 메뉴에 추가
      if (items && items.length > 0) {
        menu.push({
          id: category.id,
          title: category.title,
          icon: category.icon,
          items: items.map(item => ({
            ...item,
            path: item.path?.startsWith('/') ? item.path : `/${item.path}`
          }))
        });
      }
    }

    console.log("메뉴 구조:", JSON.stringify(menu));
    return res.status(200).json(menu);
  } catch (error) {
    console.error('메뉴 조회 오류:', error);
    return res.status(500).json({ error: "menu-error" });
  }
});

// 공개 서비스 카테고리 조회 (일반 사용자용)
router.get("/service-categories", async (req, res) => {
  try {
    const publicCategories = await db.query.serviceCategories.findMany({
      where: eq(serviceCategories.isPublic, true),
      orderBy: [asc(serviceCategories.order), asc(serviceCategories.id)]
    });
    return res.json(publicCategories);
  } catch (error) {
    console.error("Error fetching public service categories:", error);
    return res.status(500).json({ error: "서비스 카테고리를 가져오는 데 실패했습니다." });
  }
});

// 서비스 항목 조회 (카테고리별 필터링 지원)
router.get("/service-items", async (req, res) => {
  try {
    const { categoryId } = req.query;
    
    if (categoryId && typeof categoryId === 'string') {
      const categoryIdNum = parseInt(categoryId);
      if (!isNaN(categoryIdNum)) {
        const items = await db.select().from(serviceItems)
          .where(eq(serviceItems.categoryId, categoryIdNum))
          .orderBy(asc(serviceItems.order));
        return res.json(items);
      }
    }

    const items = await db.select().from(serviceItems).orderBy(asc(serviceItems.order));
    res.json(items);
  } catch (error) {
    console.error("Error fetching service items:", error);
    res.status(500).json({ error: "Failed to fetch service items" });
  }
});

export default router;
