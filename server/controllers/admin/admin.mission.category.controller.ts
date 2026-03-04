import { Request, Response } from "express";
import { missionCategoriesInsertSchema } from "@shared/schema";
import { MissionCategoryService } from "../../services/mission/mission.category.service";

export class AdminMissionCategoryController {
  private categoryService: MissionCategoryService;

  constructor() {
    this.categoryService = new MissionCategoryService();
    // 바인딩: Express 라우터에서 this를 유지하기 위해
    this.getAllCategories = this.getAllCategories.bind(this);
    this.createCategory = this.createCategory.bind(this);
    this.updateCategory = this.updateCategory.bind(this);
    this.deleteCategory = this.deleteCategory.bind(this);
    this.reorderCategories = this.reorderCategories.bind(this);
  }

  async getAllCategories(req: Request, res: Response) {
    try {
      const categories = await this.categoryService.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching mission categories:", error);
      res.status(500).json({ error: "미션 카테고리 조회 실패" });
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const categoryData = missionCategoriesInsertSchema.parse(req.body);
      const newCategory = await this.categoryService.createCategory(categoryData);
      res.status(201).json(newCategory);
    } catch (error: any) {
      console.error("Error creating mission category:", error);
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "유효하지 않은 데이터", details: error.errors });
      }
      res.status(500).json({ error: "미션 카테고리 생성 실패" });
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const categoryData = missionCategoriesInsertSchema.partial().parse(req.body);
      
      const updatedCategory = await this.categoryService.updateCategory(id, categoryData);
      
      if (!updatedCategory) {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }

      res.json(updatedCategory);
    } catch (error: any) {
      console.error("Error updating mission category:", error);
      if (error.name === "ZodError") {
        return res
          .status(400)
          .json({ error: "유효하지 않은 데이터", details: error.errors });
      }
      res.status(500).json({ error: "미션 카테고리 수정 실패" });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deletedCategory = await this.categoryService.deleteCategory(id);
      
      res.json({
        message: "카테고리가 삭제되었습니다",
        category: deletedCategory,
      });
    } catch (error: any) {
      if (error.message === "NOT_FOUND") {
        return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
      }
      if (error.message === "IN_USE") {
        return res.status(400).json({
          error: "이 카테고리를 사용하는 미션이 있어 삭제할 수 없습니다",
        });
      }
      console.error("Error deleting mission category:", error);
      res.status(500).json({ error: "미션 카테고리 삭제 실패" });
    }
  }

  async reorderCategories(req: Request, res: Response) {
    try {
      const { categoryIds } = req.body as { categoryIds: number[] };

      if (!Array.isArray(categoryIds)) {
        return res
          .status(400)
          .json({ error: "categoryIds는 배열이어야 합니다" });
      }

      await this.categoryService.reorderCategories(categoryIds);
      res.json({ message: "카테고리 순서가 변경되었습니다" });
    } catch (error) {
      console.error("Error reordering categories:", error);
      res.status(500).json({ error: "카테고리 순서 변경 실패" });
    }
  }
}
