import { Request, Response } from "express";
import { UserMissionService } from "../../services/mission/mission.user.service";

export class UserMissionController {
  private userMissionService: UserMissionService;

  constructor() {
    this.userMissionService = new UserMissionService();
    this.getMyParticipatedMissions = this.getMyParticipatedMissions.bind(this);
    this.getPublicMissions = this.getPublicMissions.bind(this);
    this.getChildMissions = this.getChildMissions.bind(this);
    this.getMissionHistory = this.getMissionHistory.bind(this);
    this.getMyMissions = this.getMyMissions.bind(this);
    this.getMissionDetail = this.getMissionDetail.bind(this);
    this.getApplicationStatus = this.getApplicationStatus.bind(this);
  }

  async getMyParticipatedMissions(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "로그인이 필요합니다" });
      }
      const data = await this.userMissionService.getMyParticipatedMissions(req.user.userId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching user's participated missions:", error);
      res.status(500).json({ error: "참여 미션 조회 실패" });
    }
  }

  async getPublicMissions(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "로그인이 필요합니다" });
      }
      const isSuperAdmin = req.user.memberType === "superadmin";
      const data = await this.userMissionService.getPublicMissions(req.user.userId, req.user.hospitalId ?? undefined, isSuperAdmin);
      res.json(data);
    } catch (error) {
      console.error("Error fetching user missions:", error);
      res.status(500).json({ error: "미션 목록 조회 실패" });
    }
  }

  async getChildMissions(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "로그인이 필요합니다" });
      }
      const parentId = parseInt(req.params.parentId);
      const data = await this.userMissionService.getChildMissions(parentId, req.user.userId);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching child missions:", error);
      if (error.message === "PARENT_NOT_FOUND") return res.status(404).json({ error: "부모 미션을 찾을 수 없습니다" });
      if (error.message === "UNAUTHORIZED_FOR_CHILD") {
        return res.status(403).json({
          error: "접근 권한이 없습니다",
          message: "부모 미션에서 승인을 받아야 하부미션에 접근할 수 있습니다",
        });
      }
      res.status(500).json({ error: "하부미션 조회 실패" });
    }
  }

  async getMissionHistory(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "로그인이 필요합니다" });
      }
      const data = await this.userMissionService.getMissionHistory(req.user.userId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching mission history:", error);
      res.status(500).json({ error: "미션 히스토리 조회 실패" });
    }
  }

  async getMyMissions(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "로그인이 필요합니다" });
      }
      const data = await this.userMissionService.getMyMissions(req.user.userId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching my missions:", error);
      res.status(500).json({ error: "내 미션 조회 실패" });
    }
  }

  async getMissionDetail(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "로그인이 필요합니다" });
      }
      const isSuperAdmin = req.user.memberType === "superadmin";
      const data = await this.userMissionService.getMissionDetail(req.params.missionId, req.user.userId, req.user.hospitalId ?? undefined, isSuperAdmin);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching mission detail:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      if (error.message === "INACTIVE_MISSION") return res.status(403).json({ error: "비활성화된 미션입니다" });
      if (error.message === "UNAUTHORIZED") return res.status(403).json({ error: "접근 권한이 없습니다" });
      
      const parts = error.message.split("|");
      if (parts[0] === "PREVIOUS_MISSION_REQUIRED") {
        return res.status(403).json({
          error: "이전 미션 승인 필요",
          message: `'${parts[1]}'을(를) 먼저 완료하고 승인을 받아야 이 미션에 접근할 수 있습니다.`,
          parentMissionId: parts[2],
        });
      }
      if (parts[0] === "ANCESTOR_MISSION_REQUIRED") {
        return res.status(403).json({
          error: "상위 미션 승인 필요",
          message: `'${parts[1]}'을(를) 먼저 완료하고 승인을 받아야 이 미션에 접근할 수 있습니다.`,
          parentMissionId: parts[2],
        });
      }
      if (parts[0] === "SIBLING_MISSION_REQUIRED") {
        return res.status(403).json({
          error: "상위 미션들 완료 필요",
          message: `모든 ${parts[3]}개의 상위 미션을 완료해야 이 미션에 접근할 수 있습니다. '${parts[1]}'을(를) 먼저 완료해주세요.`,
          requiredMissionId: parts[2],
        });
      }

      res.status(500).json({ error: "미션 상세 조회 실패" });
    }
  }

  async getApplicationStatus(req: Request, res: Response) {
    try {
      const data = await this.userMissionService.getApplicationStatus(parseInt(req.params.id));
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching application status:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      res.status(500).json({ error: "신청 현황 조회 실패" });
    }
  }
}
