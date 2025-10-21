import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { db } from "@db";
import { eq } from "drizzle-orm";
import {
  addFileToApplication,
  getApplicationFiles,
  deleteFile as deleteFileService,
  getApplicationFileStats,
  validateFileType,
  generateSafeFileName
} from "../services/file-upload";
import {
  getAllMilestones,
  getCampaignMilestones,
  getAllMilestoneCategories,
  getAvailableMilestones,
  getUserCompletedMilestones,
  completeMilestone,
  applyToMilestone,
  getUserApplications,
  getApplicationDetails,
  cancelApplication,
  getUserAchievementStats,
  getMilestoneCategoryById
} from "../services/milestones";
import { milestoneApplicationFiles } from "../../shared/schema";

const router = Router();

// Multer configuration for milestone file uploads
const upload = multer({
  dest: 'uploads/milestone-files/',
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  }
});

// ============================================
// Milestone Application File Routes
// ============================================

// 파일 업로드 (단일 파일)
router.post('/milestone-applications/:applicationId/files', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    if (!validateFileType(req.file.mimetype)) {
      return res.status(400).json({
        error: '허용되지 않은 파일 타입입니다.',
        allowed: ['이미지 파일 (JPG, PNG, GIF)', 'PDF', '텍스트', 'Word 문서']
      });
    }

    const safeFileName = generateSafeFileName(req.file.originalname);

    const newFile = await addFileToApplication({
      applicationId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      uploadedBy: userId
    });

    res.status(201).json({
      success: true,
      file: newFile,
      message: '파일이 성공적으로 업로드되었습니다.'
    });
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '파일 업로드에 실패했습니다.'
    });
  }
});

// 신청의 파일 목록 조회
router.get('/milestone-applications/:applicationId/files', requireAuth, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId);

    const files = await getApplicationFiles(applicationId);
    const stats = await getApplicationFileStats(applicationId);

    res.json({
      files,
      stats
    });
  } catch (error) {
    console.error('파일 목록 조회 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '파일 목록 조회에 실패했습니다.'
    });
  }
});

// 파일 삭제
router.delete('/milestone-application-files/:fileId', requireAuth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const result = await deleteFileService(fileId, userId);
    res.json(result);
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '파일 삭제에 실패했습니다.'
    });
  }
});

// 파일 다운로드
router.get('/milestone-application-files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);

    const file = await db.query.milestoneApplicationFiles.findFirst({
      where: eq(milestoneApplicationFiles.id, fileId),
      with: {
        application: {
          columns: {
            userId: true
          }
        }
      }
    });

    if (!file) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const userId = req.user?.id;
    const isOwner = file.application.userId === userId || file.uploadedBy === userId;
    const isAdmin = req.user?.memberType === 'admin' || req.user?.memberType === 'superadmin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: '파일에 접근할 권한이 없습니다.' });
    }

    res.download(file.filePath, file.fileName);
  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '파일 다운로드에 실패했습니다.'
    });
  }
});

// ============================================
// Milestone Routes
// ============================================

// 모든 마일스톤 조회 (정보형 + 참여형)
router.get("/milestones", async (req, res) => {
  try {
    const { type, hospitalId } = req.query;
    const milestones = await getAllMilestones({
      type: type as string,
      hospitalId: hospitalId ? Number(hospitalId) : undefined
    });
    return res.json(milestones);
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

// 참여형 마일스톤만 조회
router.get("/milestones/campaigns", async (req, res) => {
  try {
    const { hospitalId, status } = req.query;
    const campaigns = await getCampaignMilestones({
      hospitalId: hospitalId ? Number(hospitalId) : undefined,
      status: status as string
    });
    return res.json(campaigns);
  } catch (error) {
    console.error("Error fetching campaign milestones:", error);
    return res.status(500).json({ error: "Failed to fetch campaign milestones" });
  }
});

// 모든 마일스톤 카테고리 조회
router.get("/milestone-categories", async (req, res) => {
  try {
    const categories = await getAllMilestoneCategories();
    return res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching milestone categories:", error);
    return res.status(500).json({
      error: "Failed to fetch milestone categories",
      message: error instanceof Error ? error.message : "마일스톤 카테고리 조회 중 오류가 발생했습니다."
    });
  }
});

router.get("/milestones/available", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);

    console.log("[마일스톤 가능 목록] 사용자 ID:", userId, "타입:", typeof userId);

    const milestones = await getAvailableMilestones(userId);
    return res.json(milestones);
  } catch (error) {
    console.error("Error fetching available milestones:", error);
    return res.status(500).json({ error: "Failed to fetch available milestones" });
  }
});

router.get("/milestones/completed", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);

    console.log("[마일스톤 완료 목록] 사용자 ID:", userId, "타입:", typeof userId);

    const milestones = await getUserCompletedMilestones(userId);
    return res.json(milestones);
  } catch (error) {
    console.error("Error fetching completed milestones:", error);
    return res.status(500).json({ error: "Failed to fetch completed milestones" });
  }
});

router.post("/milestones/:milestoneId/complete", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다" });
    }

    const { milestoneId } = req.params;
    const { notes, photoUrl } = req.body;

    console.log("[마일스톤 완료 처리] 사용자 ID:", userId, "마일스톤 ID:", milestoneId);

    const result = await completeMilestone(userId, milestoneId, notes);

    return res.json(result);
  } catch (error) {
    console.error("Error completing milestone:", error);
    return res.status(500).json({ error: "Failed to complete milestone" });
  }
});

// 참여형 마일스톤 신청
router.post("/milestones/applications", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    const { milestoneId, applicationData } = req.body;

    console.log("[마일스톤 신청] 사용자 ID:", userId, "마일스톤 ID:", milestoneId, "신청 데이터:", applicationData);

    const application = await applyToMilestone(userId, milestoneId, applicationData);
    return res.status(201).json(application);
  } catch (error) {
    console.error("Error applying to milestone:", error);
    return res.status(500).json({ error: "Failed to apply to milestone" });
  }
});

// 사용자의 신청 내역 조회
router.get("/milestones/applications", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    const { status, milestoneId } = req.query;

    console.log("[신청 내역 조회] 사용자 ID:", userId);

    const applications = await getUserApplications(userId, {
      status: status as string,
      milestoneId: milestoneId as string
    });
    return res.json(applications);
  } catch (error) {
    console.error("Error fetching user applications:", error);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// 특정 신청의 상세 정보 조회
router.get("/milestones/applications/:applicationId", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    const { applicationId } = req.params;

    console.log("[신청 상세 조회] 사용자 ID:", userId, "신청 ID:", applicationId);

    const application = await getApplicationDetails(Number(applicationId), userId);
    return res.json(application);
  } catch (error) {
    console.error("Error fetching application details:", error);
    return res.status(500).json({ error: "Failed to fetch application details" });
  }
});

// 신청 취소 API
router.patch("/milestones/applications/:applicationId/cancel", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);
    const { applicationId } = req.params;

    console.log("[신청 취소] 사용자 ID:", userId, "신청 ID:", applicationId);

    const result = await cancelApplication(Number(applicationId), userId);
    return res.json(result);
  } catch (error) {
    console.error("Error cancelling application:", error);
    return res.status(500).json({ error: "Failed to cancel application" });
  }
});

router.get("/milestones/stats", requireAuth, async (req, res) => {
  try {
    const userIdRaw = req.user!.userId || req.user!.id || req.user!.sub;
    const userId = Number(userIdRaw);

    console.log("[마일스톤 통계] 사용자 ID:", userId, "타입:", typeof userId);

    const stats = await getUserAchievementStats(userId);
    return res.json(stats);
  } catch (error) {
    console.error("Error fetching achievement stats:", error);
    return res.status(500).json({ error: "Failed to fetch achievement stats" });
  }
});

router.get("/milestone-categories/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await getMilestoneCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
    }

    return res.json(category);
  } catch (error) {
    console.error("Error fetching milestone category:", error);
    return res.status(500).json({
      error: "카테고리 정보를 가져오는데 실패했습니다",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
