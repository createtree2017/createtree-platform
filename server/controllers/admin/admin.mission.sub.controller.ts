import { Request, Response } from "express";
import { subMissionsInsertSchema } from "@shared/schema";
import { z } from "zod";
import { MissionSubService } from "../../services/mission/mission.sub.service";

const subMissionReorderSchema = z.object({
  subMissionOrders: z.array(
    z.object({
      id: z.number().int().positive(),
      order: z.number().int().min(0),
    }),
  ),
});

export class AdminMissionSubController {
  private subService: MissionSubService;

  constructor() {
    this.subService = new MissionSubService();
    this.getSubMissions = this.getSubMissions.bind(this);
    this.createSubMission = this.createSubMission.bind(this);
    this.updateSubMission = this.updateSubMission.bind(this);
    this.deleteSubMission = this.deleteSubMission.bind(this);
    this.reorderSubMissions = this.reorderSubMissions.bind(this);
    this.duplicateSubMission = this.duplicateSubMission.bind(this);
  }

  async getSubMissions(req: Request, res: Response) {
    try {
      const { missionId } = req.params;
      const subs = await this.subService.getSubMissions(missionId);
      res.json(subs);
    } catch (error: any) {
      if (error.message === "MISSION_NOT_FOUND") {
        return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      }
      console.error("Error fetching sub missions:", error);
      res.status(500).json({ error: "세부 미션 조회 실패" });
    }
  }

  async createSubMission(req: Request, res: Response) {
    try {
      const { missionId } = req.params;
      const subMissionData = subMissionsInsertSchema.parse({
        ...req.body,
        themeMissionId: 0, // Bypass initial check, will be replaced in service
      });

      const newSubMission = await this.subService.createSubMission(missionId, req.body);
      res.status(201).json(newSubMission);
    } catch (error: any) {
      console.error("Error creating sub mission:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
      }
      if (error.message === "MISSION_NOT_FOUND") {
        return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      }
      res.status(500).json({ error: "세부 미션 생성 실패" });
    }
  }

  async updateSubMission(req: Request, res: Response) {
    try {
      const subId = parseInt(req.params.subId);
      const subMissionData = subMissionsInsertSchema.partial().parse(req.body);
      const updatedSubMission = await this.subService.updateSubMission(subId, req.body);
      res.json(updatedSubMission);
    } catch (error: any) {
      console.error("Error updating sub mission:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
      }
      if (error.message === "NOT_FOUND") {
        return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
      }
      res.status(500).json({ error: "세부 미션 수정 실패" });
    }
  }

  async deleteSubMission(req: Request, res: Response) {
    try {
      const subId = parseInt(req.params.subId);
      const deletedSubMission = await this.subService.deleteSubMission(subId);
      res.json({ message: "세부 미션이 삭제되었습니다", subMission: deletedSubMission });
    } catch (error: any) {
      if (error.message === "NOT_FOUND") {
        return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
      }
      console.error("Error deleting sub mission:", error);
      res.status(500).json({ error: "세부 미션 삭제 실패" });
    }
  }

  async reorderSubMissions(req: Request, res: Response) {
    try {
      const parseResult = subMissionReorderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "잘못된 요청 형식입니다", details: parseResult.error.errors });
      }
      await this.subService.reorderSubMissions(parseResult.data.subMissionOrders);
      res.json({ success: true, message: "세부 미션 순서가 변경되었습니다" });
    } catch (error) {
      console.error("세부 미션 순서 업데이트 오류:", error);
      res.status(500).json({ error: "세부 미션 순서 업데이트 실패" });
    }
  }

  async duplicateSubMission(req: Request, res: Response) {
    try {
      const subId = parseInt(req.params.subId);
      const newSubMission = await this.subService.duplicateSubMission(subId);
      res.status(201).json(newSubMission);
    } catch (error: any) {
      console.error("Error duplicating sub mission:", error);
      if (error.message === "NOT_FOUND") {
        return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
      }
      res.status(500).json({ error: "세부 미션 복사 실패" });
    }
  }
}
