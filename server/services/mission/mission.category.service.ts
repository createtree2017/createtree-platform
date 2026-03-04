import { db } from "@db";
import { missionCategories, themeMissions } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export class MissionCategoryService {
  /**
   * 모든 카테고리를 순서와 ID에 따라 오름차순으로 조회합니다.
   */
  async getAllCategories() {
    return await db.query.missionCategories.findMany({
      orderBy: [asc(missionCategories.order), asc(missionCategories.id)],
    });
  }

  /**
   * 새 카테고리를 생성합니다.
   */
  async createCategory(categoryData: any) {
    const [newCategory] = await db
      .insert(missionCategories)
      .values(categoryData)
      .returning();
    return newCategory;
  }

  /**
   * 지정된 ID의 카테고리를 수정합니다.
   */
  async updateCategory(id: number, categoryData: any) {
    const [updatedCategory] = await db
      .update(missionCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(missionCategories.id, id))
      .returning();
    return updatedCategory;
  }

  /**
   * 지정된 ID의 카테고리를 삭제합니다.
   * 연관된 미션이 있으면 삭제가 불가합니다.
   */
  async deleteCategory(id: number) {
    const category = await db.query.missionCategories.findFirst({
      where: eq(missionCategories.id, id),
    });

    if (!category) {
      throw new Error("NOT_FOUND");
    }

    const missionsUsingCategory = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.categoryId, category.categoryId),
    });

    if (missionsUsingCategory) {
      throw new Error("IN_USE");
    }

    const [deletedCategory] = await db
      .delete(missionCategories)
      .where(eq(missionCategories.id, id))
      .returning();

    return deletedCategory;
  }

  /**
   * 주어진 카테고리 ID 배열 순서대로 order 필드를 업데이트합니다.
   */
  async reorderCategories(categoryIds: number[]) {
    const updates = categoryIds.map((id, index) =>
      db
        .update(missionCategories)
        .set({ order: index, updatedAt: new Date() })
        .where(eq(missionCategories.id, id))
    );

    await Promise.all(updates);
  }
}
