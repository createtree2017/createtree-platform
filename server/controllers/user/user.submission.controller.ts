import { Request, Response } from "express";
import { UserSubmissionService } from "../../services/mission/mission.submission.service";

export class UserSubmissionController {
  private userSubmissionService: UserSubmissionService;

  constructor() {
    this.userSubmissionService = new UserSubmissionService();
    this.startMission = this.startMission.bind(this);
    this.submitSubMission = this.submitSubMission.bind(this);
    this.cancelSubmission = this.cancelSubmission.bind(this);
    this.cancelApplication = this.cancelApplication.bind(this);
    this.completeMission = this.completeMission.bind(this);
    this.verifyAttendance = this.verifyAttendance.bind(this);
  }

  async startMission(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const data = await this.userSubmissionService.startMission(req.params.missionId, req.user.userId);
      res.status(201).json(data);
    } catch (error: any) {
      console.error("Error starting mission:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      if (error.message === "ALREADY_STARTED") return res.status(400).json({ error: "이미 시작한 미션입니다" });
      res.status(500).json({ error: "미션 시작 실패" });
    }
  }

  async submitSubMission(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const { submission, isUpdate } = await this.userSubmissionService.submitSubMission(
        req.params.missionId,
        parseInt(req.params.subMissionId),
        req.user.userId,
        req.body
      );
      res.status(isUpdate ? 200 : 201).json(submission);
    } catch (error: any) {
      console.error("Error submitting sub mission:", error);
      if (error.message === "MISSION_NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      if (error.message === "NOT_STARTED_YET") return res.status(400).json({ error: "미션이 아직 시작되지 않았습니다" });
      if (error.message === "ALREADY_ENDED") return res.status(400).json({ error: "미션 기간이 종료되었습니다" });
      if (error.message === "SUB_MISSION_NOT_FOUND") return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
      if (error.message === "ALREADY_APPROVED") return res.status(403).json({ error: "승인된 세부 미션은 수정할 수 없습니다" });
      
      res.status(500).json({ error: "세부 미션 제출 실패" });
    }
  }

  async cancelSubmission(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const data = await this.userSubmissionService.cancelSubmission(
        req.params.missionId,
        parseInt(req.params.subMissionId),
        req.user.userId
      );
      res.json({ message: "제출이 취소되었습니다", submission: data });
    } catch (error: any) {
      console.error("Error canceling submission:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "제출 내역을 찾을 수 없습니다" });
      if (error.message === "ALREADY_APPROVED") return res.status(403).json({ error: "승인된 세부 미션은 취소할 수 없습니다" });
      res.status(500).json({ error: "제출 취소 실패" });
    }
  }

  async cancelApplication(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const data = await this.userSubmissionService.cancelApplication(
        req.params.missionId,
        parseInt(req.params.subMissionId),
        req.user.userId
      );
      res.json({ message: "신청이 취소되었습니다. 다시 신청하실 수 있습니다.", submission: data });
    } catch (error: any) {
      console.error("Error canceling application:", error);
      if (error.message === "SUB_MISSION_NOT_FOUND") return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
      if (error.message === "NOT_APPLICATION_TYPE") return res.status(400).json({ error: "신청 타입 세부미션만 취소할 수 있습니다" });
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "신청 내역을 찾을 수 없습니다" });
      res.status(500).json({ error: "신청 취소 실패" });
    }
  }

  async completeMission(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const data = await this.userSubmissionService.completeMission(req.params.missionId, req.user.userId);
      res.json(data);
    } catch (error: any) {
      console.error("Error completing mission:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "미션을 찾을 수 없습니다" });
      if (error.message === "NO_PROGRESS") return res.status(404).json({ error: "미션 진행 내역을 찾을 수 없습니다" });
      
      const parts = error.message.split("|");
      if (parts[0] === "INCOMPLETE") {
        return res.status(400).json({
          error: "모든 세부 미션이 승인되어야 완료할 수 있습니다",
          approved: parseInt(parts[1]),
          total: parseInt(parts[2]),
        });
      }
      
      res.status(500).json({ error: "미션 완료 실패" });
    }
  }

  async verifyAttendance(req: Request, res: Response) {
    try {
      if (!req.user || !req.user.userId) return res.status(401).json({ error: "로그인이 필요합니다" });
      const { password } = req.body;
      const data = await this.userSubmissionService.verifyAttendance(parseInt(req.params.id), password, req.user.userId);
      res.json({ success: true, message: "출석이 확인되었습니다" });
    } catch (error: any) {
      console.error("Error verifying attendance:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "세부 미션을 찾을 수 없습니다" });
      if (error.message === "INVALID_TYPE") return res.status(400).json({ error: "출석인증 제출 타입이 아닙니다" });
      if (error.message === "INVALID_PASSWORD") return res.status(400).json({ error: "비밀번호가 일치하지 않습니다" });
      res.status(500).json({ error: "출석 인증 실패" });
    }
  }
}
