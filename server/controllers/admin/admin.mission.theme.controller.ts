import { Request, Response } from "express";
import { themeMissionsInsertSchema } from "@shared/schema";
import { z } from "zod";
import { MissionThemeService } from "../../services/mission/mission.theme.service";

const missionReorderSchema = z.object({
  missionOrders: z.array(
    z.object({
      id: z.number().int().positive(),
      order: z.number().int().min(0),
      folderId: z.number().int().positive().nullable(),
    }),
  ),
});

const childMissionCreateSchema = z.object({
  missionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export class AdminMissionThemeController {
  private themeService: MissionThemeService;

  constructor() {
    this.themeService = new MissionThemeService();
    this.uploadHeaderImage = this.uploadHeaderImage.bind(this);
    this.reorderMissions = this.reorderMissions.bind(this);
    this.getAdminMissions = this.getAdminMissions.bind(this);
    this.getMissionById = this.getMissionById.bind(this);
    this.createMission = this.createMission.bind(this);
    this.updateMission = this.updateMission.bind(this);
    this.deleteMission = this.deleteMission.bind(this);
    this.duplicateMission = this.duplicateMission.bind(this);
    
    // Child and Stats
    this.getChildMissions = this.getChildMissions.bind(this);
    this.createChildMission = this.createChildMission.bind(this);
    this.getApprovedUsers = this.getApprovedUsers.bind(this);
    this.toggleActive = this.toggleActive.bind(this);
    this.getAdminStats = this.getAdminStats.bind(this);
    this.moveMissionToFolder = this.moveMissionToFolder.bind(this);
  }

  async uploadHeaderImage(req: Request, res: Response) {
    try {
      const file = req.file;
      const result = await this.themeService.uploadHeaderImage(file);
      res.json({ success: true, ...result });
    } catch (error: any) {
      if (error.message === "FILE_REQUIRED") {
        return res.status(400).json({ success: false, error: "이미지 파일이 필요합니다" });
      }
      res.status(500).json({ success: false, error: "이미지 업로드 실패" });
    }
  }

  async reorderMissions(req: Request, res: Response) {
    try {
      const parseResult = missionReorderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "잘못된 요청 형식입니다", details: parseResult.error.errors });
      }
      await this.themeService.reorderMissions(parseResult.data.missionOrders);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "미션 순서 업데이트 실패" });
    }
  }

  async getAdminMissions(req: Request, res: Response) {
    try {
      const filters = {
        visibilityType: req.query.visibilityType as string,
        hospitalId: req.query.hospitalId ? parseInt(req.query.hospitalId as string) : undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
        categoryId: req.query.categoryId as string,
        parentMissionId: req.query.parentMissionId ? parseInt(req.query.parentMissionId as string) : undefined,
      };
      res.json(await this.themeService.getAdminMissions(filters));
    } catch (error) {
      res.status(500).json({ error: "주제 미션 조회 실패" });
    }
  }

  async getMissionById(req: Request, res: Response) {
    try {
      res.json(await this.themeService.getMissionById(req.params.missionId));
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "주제 미션 조회 실패" });
    }
  }

  async createMission(req: Request, res: Response) {
    try {
      const missionData = themeMissionsInsertSchema.parse(req.body);
      res.status(201).json(await this.themeService.createMission(missionData));
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
      if (error.message === "HOSPITAL_ID_REQUIRED") return res.status(400).json({ error: "병원 전용 미션은 병원을 선택해야 합니다" });
      if (error.code === "23505") return res.status(400).json({ error: "이미 존재하는 미션 ID입니다. 다른 ID를 사용해주세요." });
      res.status(500).json({ error: "주제 미션 생성 실패" });
    }
  }

  async updateMission(req: Request, res: Response) {
    try {
      res.json(await this.themeService.updateMission(parseInt(req.params.id), req.body));
    } catch (error: any) {
      if (error.message === "HOSPITAL_ID_REQUIRED") return res.status(400).json({ error: "병원 전용 미션은 병원을 선택해야 합니다" });
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "주제 미션 수정 실패" });
    }
  }

  async deleteMission(req: Request, res: Response) {
    try {
      res.json({ message: "미션이 삭제되었습니다", mission: await this.themeService.deleteMission(parseInt(req.params.id)) });
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "주제 미션 삭제 실패" });
    }
  }

  async duplicateMission(req: Request, res: Response) {
    try {
      res.status(201).json(await this.themeService.duplicateMission(parseInt(req.params.id)));
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      if (error.code === "23505") return res.status(400).json({ error: "복사 중 중복 오류가 발생했습니다. 다시 시도해주세요." });
      res.status(500).json({ error: "주제 미션 복사 실패" });
    }
  }

  async getChildMissions(req: Request, res: Response) {
    try {
      res.json(await this.themeService.getChildMissions(parseInt(req.params.parentId)));
    } catch (error) {
      res.status(500).json({ error: "하부미션 조회 실패" });
    }
  }

  async createChildMission(req: Request, res: Response) {
    try {
      const parentId = parseInt(req.params.parentId);
      const missionData = childMissionCreateSchema.parse(req.body);
      res.status(201).json(await this.themeService.createChildMission(parentId, missionData));
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ error: "유효하지 않은 데이터", details: error.errors });
      if (error.message === "PARENT_NOT_FOUND") return res.status(404).json({ error: "부모 미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "하부미션 생성 실패" });
    }
  }

  async getApprovedUsers(req: Request, res: Response) {
    try {
      const parentId = parseInt(req.params.parentId);
      const users = await this.themeService.getApprovedUsers(parentId);
      res.json({ parentMissionId: parentId, approvedCount: users.length, users });
    } catch (error) {
      res.status(500).json({ error: "승인된 사용자 조회 실패" });
    }
  }

  async toggleActive(req: Request, res: Response) {
    try {
      res.json(await this.themeService.toggleActive(parseInt(req.params.id)));
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "미션 활성화 상태 변경 실패" });
    }
  }

  async getAdminStats(req: Request, res: Response) {
    try {
      res.json(await this.themeService.getAdminStats());
    } catch (error) {
      res.status(500).json({ error: "미션 통계 조회 실패" });
    }
  }

  async moveMissionToFolder(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { folderId } = req.body;
      res.json(await this.themeService.moveMissionToFolder(id, folderId));
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "폴더 이동 실패" });
    }
  }
}
