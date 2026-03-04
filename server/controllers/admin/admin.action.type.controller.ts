import { Request, Response } from "express";
import { ActionTypeService } from "../../services/mission/action.type.service";
import { actionTypesInsertSchema } from "@shared/schema";
import { z } from "zod";

export class AdminActionTypeController {
  private actionTypeService: ActionTypeService;

  constructor() {
    this.actionTypeService = new ActionTypeService();
    this.getAllActionTypes = this.getAllActionTypes.bind(this);
    this.getActiveActionTypes = this.getActiveActionTypes.bind(this);
    this.createActionType = this.createActionType.bind(this);
    this.updateActionType = this.updateActionType.bind(this);
    this.deleteActionType = this.deleteActionType.bind(this);
    this.reorderActionTypes = this.reorderActionTypes.bind(this);
  }

  async getAllActionTypes(req: Request, res: Response) {
    try {
      const data = await this.actionTypeService.getAllActionTypes();
      res.json(data);
    } catch (error) {
      console.error("error:", error);
      res.status(500).json({ error: "액션 타입 조회 실패" });
    }
  }

  async getActiveActionTypes(req: Request, res: Response) {
    try {
      const data = await this.actionTypeService.getActiveActionTypes();
      res.json(data);
    } catch (error) {
      console.error("error:", error);
      res.status(500).json({ error: "액션 타입 조회 실패" });
    }
  }

  async createActionType(req: Request, res: Response) {
    try {
      const parsed = actionTypesInsertSchema.parse(req.body);
      const data = await this.actionTypeService.createActionType(parsed);
      res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ errors: error.errors });
      console.error("error:", error);
      res.status(500).json({ error: "액션 타입 생성 실패" });
    }
  }

  async updateActionType(req: Request, res: Response) {
    try {
      const data = await this.actionTypeService.updateActionType(parseInt(req.params.id), req.body);
      res.json(data);
    } catch (error: any) {
      console.error("error:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "액션 타입을 찾을 수 없습니다" });
      if (error.message === "SYSTEM_NAME_IMMUTABLE") return res.status(400).json({ error: "시스템 기본 액션 타입의 이름은 변경할 수 없습니다" });
      res.status(500).json({ error: "액션 타입 수정 실패" });
    }
  }

  async deleteActionType(req: Request, res: Response) {
    try {
      const data = await this.actionTypeService.deleteActionType(parseInt(req.params.id));
      res.json(data);
    } catch (error: any) {
      console.error("error:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "액션 타입을 찾을 수 없습니다" });
      if (error.message === "SYSTEM_IMMUTABLE") return res.status(400).json({ error: "시스템 기본 액션 타입은 삭제할 수 없습니다" });
      if (error.message === "IN_USE") return res.status(400).json({ error: "사용 중인 액션 타입은 삭제할 수 없습니다" });
      res.status(500).json({ error: "액션 타입 삭제 실패" });
    }
  }

  async reorderActionTypes(req: Request, res: Response) {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      if (!orderedIds || !Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds 배열이 필요합니다" });
      }
      const data = await this.actionTypeService.reorderActionTypes(orderedIds);
      res.json(data);
    } catch (error: any) {
      console.error("error:", error);
      res.status(500).json({ error: "액션 타입 순서 변경 실패" });
    }
  }
}
