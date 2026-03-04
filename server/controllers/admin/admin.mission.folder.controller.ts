import { Request, Response } from "express";
import { AdminMissionFolderService } from "../../services/mission/admin.mission.folder.service";
import { missionFoldersInsertSchema } from "@shared/schema";
import { z } from "zod";

const folderReorderSchema = z.object({
  folderIds: z.array(z.number().int().positive()),
});

export class AdminMissionFolderController {
  private adminMissionFolderService: AdminMissionFolderService;

  constructor() {
    this.adminMissionFolderService = new AdminMissionFolderService();
    this.getAllFolders = this.getAllFolders.bind(this);
    this.createFolder = this.createFolder.bind(this);
    this.reorderFolders = this.reorderFolders.bind(this);
    this.updateFolder = this.updateFolder.bind(this);
    this.deleteFolder = this.deleteFolder.bind(this);
  }

  async getAllFolders(req: Request, res: Response) {
    try {
      const data = await this.adminMissionFolderService.getAllFolders();
      res.json(data);
    } catch (error) {
      console.error("폴더 목록 조회 오류:", error);
      res.status(500).json({ error: "폴더 목록 조회 실패" });
    }
  }

  async createFolder(req: Request, res: Response) {
    try {
      const parsed = missionFoldersInsertSchema.parse(req.body);
      const data = await this.adminMissionFolderService.createFolder(parsed);
      res.status(201).json(data);
    } catch (error) {
      console.error("폴더 생성 오류:", error);
      res.status(500).json({ error: "폴더 생성 실패" });
    }
  }

  async reorderFolders(req: Request, res: Response) {
    try {
      const parseResult = folderReorderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "잘못된 요청 형식입니다",
          details: parseResult.error.errors,
        });
      }
      await this.adminMissionFolderService.reorderFolders(parseResult.data.folderIds);
      res.json({ success: true });
    } catch (error) {
      console.error("폴더 순서 업데이트 오류:", error);
      res.status(500).json({ error: "폴더 순서 업데이트 실패" });
    }
  }

  async updateFolder(req: Request, res: Response) {
    try {
      const data = await this.adminMissionFolderService.updateFolder(parseInt(req.params.id), req.body);
      res.json(data);
    } catch (error: any) {
      console.error("폴더 업데이트 오류:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "폴더를 찾을 수 없습니다" });
      res.status(500).json({ error: "폴더 업데이트 실패" });
    }
  }

  async deleteFolder(req: Request, res: Response) {
    try {
      const data = await this.adminMissionFolderService.deleteFolder(parseInt(req.params.id));
      res.json({ success: true, folder: data });
    } catch (error: any) {
      console.error("폴더 삭제 오류:", error);
      if (error.message === "NOT_FOUND") return res.status(404).json({ error: "폴더를 찾을 수 없습니다" });
      res.status(500).json({ error: "폴더 삭제 실패" });
    }
  }
}
