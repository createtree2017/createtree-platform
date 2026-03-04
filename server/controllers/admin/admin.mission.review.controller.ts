import { Request, Response } from "express";
import { AdminMissionReviewService } from "../../services/mission/admin.mission.review.service";

export class AdminMissionReviewController {
  private adminMissionReviewService: AdminMissionReviewService;

  constructor() {
    this.adminMissionReviewService = new AdminMissionReviewService();
    this.getThemeMissionsWithStats = this.getThemeMissionsWithStats.bind(this);
    this.getSubMissionsWithStats = this.getSubMissionsWithStats.bind(this);
    this.getSubmissions = this.getSubmissions.bind(this);
    this.approveSubmission = this.approveSubmission.bind(this);
    this.rejectSubmission = this.rejectSubmission.bind(this);
    this.updateSubmissionStatus = this.updateSubmissionStatus.bind(this);
    this.getRecentActivities = this.getRecentActivities.bind(this);
  }

  async getThemeMissionsWithStats(req: Request, res: Response) {
    try {
      const data = await this.adminMissionReviewService.getThemeMissionsWithStats(
        req.user?.memberType ?? undefined,
        req.user?.hospitalId ?? undefined,
        req.query.hospitalId
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching theme missions with stats:", error);
      if (error.message === "UNAUTHORIZED_HOSPITAL") {
        return res.status(403).json({ error: "병원 관리자는 다른 병원의 데이터를 조회할 수 없습니다" });
      }
      if (error.message === "NO_HOSPITAL_INFO") {
        return res.status(403).json({ error: "병원 정보가 없습니다" });
      }
      res.status(500).json({ error: "주제미션 통계 조회 실패" });
    }
  }

  async getSubMissionsWithStats(req: Request, res: Response) {
    try {
      const data = await this.adminMissionReviewService.getSubMissionsWithStats(
        req.params.missionId,
        req.user?.memberType ?? undefined,
        req.user?.hospitalId ?? undefined
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching sub missions with stats:", error);
      if (error.message === "MISSION_NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      if (error.message === "NO_HOSPITAL_INFO") return res.status(403).json({ error: "병원 정보가 없습니다" });
      if (error.message === "UNAUTHORIZED") return res.status(403).json({ error: "접근 권한이 없습니다" });
      res.status(500).json({ error: "세부미션 통계 조회 실패" });
    }
  }

  async getSubmissions(req: Request, res: Response) {
    try {
      const data = await this.adminMissionReviewService.getSubmissions(
        req.query,
        req.user?.memberType ?? undefined,
        req.user?.hospitalId ?? undefined
      );
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      if (error.message === "UNAUTHORIZED_HOSPITAL") {
        return res.status(403).json({ error: "병원 관리자는 다른 병원의 데이터를 조회할 수 없습니다" });
      }
      if (error.message === "NO_HOSPITAL_INFO") {
        return res.status(403).json({ error: "병원 정보가 없습니다" });
      }
      if (error.message === "UNAUTHORIZED") {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      res.status(500).json({ error: "제출 내역 조회 실패" });
    }
  }

  async approveSubmission(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const data = await this.adminMissionReviewService.approveSubmission(parseInt(req.params.submissionId), req.user.userId);
      res.json(data);
    } catch (error: any) {
      console.error("Error approving submission:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "제출 내역을 찾을 수 없습니다" });
      if (error.message === "NOT_PENDING") return res.status(400).json({ error: "검수 대기 상태의 제출만 승인할 수 있습니다" });
      res.status(500).json({ error: "세부 미션 승인 실패" });
    }
  }

  async rejectSubmission(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const { rejectReason } = req.body;
      const data = await this.adminMissionReviewService.rejectSubmission(parseInt(req.params.submissionId), req.user.userId, rejectReason);
      res.json(data);
    } catch (error: any) {
      console.error("Error rejecting submission:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "제출 내역을 찾을 수 없습니다" });
      if (error.message === "NOT_PENDING") return res.status(400).json({ error: "검수 대기 상태의 제출만 반려할 수 있습니다" });
      res.status(500).json({ error: "세부 미션 반려 실패" });
    }
  }

  async updateSubmissionStatus(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const { submissionIds, status, rejectReason } = req.body;
      
      if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({ error: "변경할 제출 ID 목록이 필요합니다" });
      }

      await this.adminMissionReviewService.bulkUpdateStatus(submissionIds, status, req.user.userId, rejectReason);
      res.json({ success: true, count: submissionIds.length });
    } catch (error: any) {
      console.error("Error updating submission statuses:", error);
      if (error.message === "INVALID_STATUS") return res.status(400).json({ error: "유효하지 않은 상태값입니다" });
      res.status(500).json({ error: "상태 변경 실패" });
    }
  }

  async getRecentActivities(req: Request, res: Response) {
    try {
      const data = await this.adminMissionReviewService.getRecentActivities(req.user?.memberType ?? undefined, req.user?.hospitalId ?? undefined);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching recent activities:", error);
      if (error.message === "NO_HOSPITAL_INFO") {
        return res.status(403).json({ error: "병원 정보가 없습니다" });
      }
      res.status(500).json({ error: "최근 제출 활동 조회 실패" });
    }
  }
}
