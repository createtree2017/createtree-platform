import { Router } from "express";
import { z } from "zod";
import { db } from "@db";
import {
  missionCategories,
  themeMissions,
  subMissions,
  userMissionProgress,
  subMissionSubmissions,
  actionTypes,
  missionFolders,
  bigMissions,
  bigMissionTopics,
  userBigMissionProgress,
  users,
  missionCategoriesInsertSchema,
  themeMissionsInsertSchema,
  subMissionsInsertSchema,
  actionTypesInsertSchema,
  missionFoldersInsertSchema,
  VISIBILITY_TYPE,
  MISSION_STATUS,
} from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray, not } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdminOrSuperAdmin } from "../middleware/auth";
import { createUploadMiddleware } from "../config/upload-config";
import {
  saveImageToGCS,
  saveFileToGCS,
  ensurePermanentUrl,
} from "../utils/gcs-image-storage";

import { AdminMissionCategoryController } from "../controllers/admin/admin.mission.category.controller";
import { AdminMissionThemeController } from "../controllers/admin/admin.mission.theme.controller";

const router = Router();
import { AdminMissionSubController } from "../controllers/admin/admin.mission.sub.controller";
import { UserMissionController } from "../controllers/user/user.mission.controller";
const adminMissionCategoryController = new AdminMissionCategoryController();
const adminMissionThemeController = new AdminMissionThemeController();
import { UserSubmissionController } from "../controllers/user/user.submission.controller";
const adminMissionSubController = new AdminMissionSubController();
const userMissionController = new UserMissionController();
import { AdminMissionReviewController } from "../controllers/admin/admin.mission.review.controller";
import { UserBigMissionController } from "../controllers/user/user.big.mission.controller";

const userSubmissionController = new UserSubmissionController();
const userBigMissionController = new UserBigMissionController();
import { AdminActionTypeController } from "../controllers/admin/admin.action.type.controller";

import { AdminMissionFolderController } from "../controllers/admin/admin.mission.folder.controller";
import { AdminBigMissionController } from "../controllers/admin/admin.big.mission.controller";

const adminActionTypeController = new AdminActionTypeController();
const adminMissionFolderController = new AdminMissionFolderController();
const adminMissionReviewController = new AdminMissionReviewController();
const adminBigMissionController = new AdminBigMissionController();

// 미션 파일 업로드용 미들웨어 (모든 파일 형식 허용, 실행 파일 제외)
const missionFileUpload = createUploadMiddleware("uploads", "all", {
  maxFileSize: 10 * 1024 * 1024, // 10MB
});

// 미션 헤더 이미지 업로드용 미들웨어 (이미지만 허용, 10MB)
const missionHeaderUpload = createUploadMiddleware("uploads", "image", {
  maxFileSize: 10 * 1024 * 1024, // 10MB
});

// ============================================
// 관리자 - 미션 카테고리 관리 API
// ============================================

router.get("/admin/mission-categories", requireAdminOrSuperAdmin, adminMissionCategoryController.getAllCategories);
router.post("/admin/mission-categories", requireAdminOrSuperAdmin, adminMissionCategoryController.createCategory);
router.put("/admin/mission-categories/:id", requireAdminOrSuperAdmin, adminMissionCategoryController.updateCategory);
router.delete("/admin/mission-categories/:id", requireAdminOrSuperAdmin, adminMissionCategoryController.deleteCategory);
router.patch("/admin/mission-categories/reorder", requireAdminOrSuperAdmin, adminMissionCategoryController.reorderCategories);

// ============================================
// 관리자 - 미션 헤더 이미지 업로드 API
// ============================================

router.post(
  "/admin/missions/upload-header",
  requireAdminOrSuperAdmin,
  missionHeaderUpload.single("headerImage"),
  adminMissionThemeController.uploadHeaderImage
);

// ============================================
// 사용자 - 큰미션 API
// ============================================
router.get("/big-missions", requireAuth, userBigMissionController.getMyBigMissions.bind(userBigMissionController));
router.get("/big-missions/:id", requireAuth, userBigMissionController.getBigMissionDetail.bind(userBigMissionController));

// ============================================
// 관리자 - 주제 미션 CRUD API
// ============================================

router.put("/admin/missions/reorder", requireAdminOrSuperAdmin, adminMissionThemeController.reorderMissions);
router.get("/admin/missions", requireAdminOrSuperAdmin, adminMissionThemeController.getAdminMissions);
router.get("/admin/missions/:missionId", requireAdminOrSuperAdmin, adminMissionThemeController.getMissionById);
router.post("/admin/missions", requireAdminOrSuperAdmin, adminMissionThemeController.createMission);
router.put("/admin/missions/:id", requireAdminOrSuperAdmin, adminMissionThemeController.updateMission);
router.put("/admin/missions/:id/folder", requireAdminOrSuperAdmin, adminMissionThemeController.moveMissionToFolder);
router.delete("/admin/missions/:id", requireAdminOrSuperAdmin, adminMissionThemeController.deleteMission);
router.post("/admin/missions/:id/duplicate", requireAdminOrSuperAdmin, adminMissionThemeController.duplicateMission);

// ============================================
// 관리자 - 하부미션 관리 API (ThemeController 연장선)
// ============================================

router.get("/admin/missions/:parentId/child-missions", requireAdminOrSuperAdmin, adminMissionThemeController.getChildMissions);
router.post("/admin/missions/:parentId/child-missions", requireAdminOrSuperAdmin, adminMissionThemeController.createChildMission);
router.get("/admin/missions/:parentId/approved-users", requireAdminOrSuperAdmin, adminMissionThemeController.getApprovedUsers);
router.patch("/admin/missions/:id/toggle-active", requireAdminOrSuperAdmin, adminMissionThemeController.toggleActive);
router.get("/admin/missions/stats", requireAdminOrSuperAdmin, adminMissionThemeController.getAdminStats);

// ============================================
// 관리자 - 세부 미션 빌더 API
// ============================================

router.get("/admin/missions/:missionId/sub-missions", requireAdminOrSuperAdmin, adminMissionSubController.getSubMissions);
router.post("/admin/missions/:missionId/sub-missions", requireAdminOrSuperAdmin, adminMissionSubController.createSubMission);
router.put("/admin/missions/:missionId/sub-missions/:subId", requireAdminOrSuperAdmin, adminMissionSubController.updateSubMission);
router.delete("/admin/missions/:missionId/sub-missions/:subId", requireAdminOrSuperAdmin, adminMissionSubController.deleteSubMission);
router.patch("/admin/missions/:missionId/sub-missions/reorder", requireAdminOrSuperAdmin, adminMissionSubController.reorderSubMissions);
router.post("/admin/missions/:missionId/sub-missions/:subId/duplicate", requireAdminOrSuperAdmin, adminMissionSubController.duplicateSubMission);
router.patch("/admin/missions/:missionId/sub-missions/:id/toggle-active", requireAdminOrSuperAdmin, adminMissionSubController.toggleActive);

// ============================================
// 사용자 - 미션 목록 및 상세 API
// ============================================

router.get("/missions/my", requireAuth, userMissionController.getMyParticipatedMissions);
router.get("/missions", requireAuth, userMissionController.getPublicMissions);
router.get("/missions/:parentId/child-missions", requireAuth, userMissionController.getChildMissions);
router.get("/missions/history", requireAuth, userMissionController.getMissionHistory);
router.get("/missions/:missionId", requireAuth, userMissionController.getMissionDetail);
router.get("/my-missions", requireAuth, userMissionController.getMyMissions);

// ============================================
// 사용자 - 세부 미션 제출 API
// ============================================

router.post("/missions/:missionId/start", requireAuth, userSubmissionController.startMission);
router.post("/missions/:missionId/sub-missions/:subMissionId/submit", requireAuth, userSubmissionController.submitSubMission);
router.delete("/missions/:missionId/sub-missions/:subMissionId/submission", requireAuth, userSubmissionController.cancelSubmission);
router.post("/missions/:missionId/sub-missions/:subMissionId/cancel-application", requireAuth, userSubmissionController.cancelApplication);
router.post("/missions/:missionId/complete", requireAuth, userSubmissionController.completeMission);


// ============================================
// 관리자 - 검수 API
// ============================================

router.get("/admin/review/theme-missions", requireAdminOrSuperAdmin, adminMissionReviewController.getThemeMissionsWithStats);
router.get("/admin/review/theme-missions/:missionId/sub-missions", requireAdminOrSuperAdmin, adminMissionReviewController.getSubMissionsWithStats);
router.get("/admin/review/submissions", requireAdminOrSuperAdmin, adminMissionReviewController.getSubmissions);
router.post("/admin/review/submissions/:submissionId/approve", requireAdminOrSuperAdmin, adminMissionReviewController.approveSubmission);
router.post("/admin/review/submissions/:submissionId/reject", requireAdminOrSuperAdmin, adminMissionReviewController.rejectSubmission);
router.patch("/admin/review/submissions/status", requireAdminOrSuperAdmin, adminMissionReviewController.updateSubmissionStatus);
router.get("/admin/review/dashboard/recent-activities", requireAdminOrSuperAdmin, adminMissionReviewController.getRecentActivities);
router.get("/admin/missions/:missionId/export-excel", requireAdminOrSuperAdmin, adminMissionReviewController.exportMissionExcel);


// ============================================
// 미션 파일 업로드 API (사용자용)
// ============================================

// 파일 업로드 (GCS 영구 저장)
router.post(
  "/missions/upload",
  requireAuth,
  missionFileUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "사용자 인증 정보가 없습니다" });
      }

      // submissionType 파라미터 확인 (file 또는 image)
      const submissionType = (req.query.submissionType as string) || "file";

      // 파일 크기 검증 (10MB)
      const maxSize = 10 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res
          .status(400)
          .json({ error: "파일 크기는 10MB 이하여야 합니다" });
      }

      // submissionType에 따른 MIME 타입 검증
      if (submissionType === "image") {
        // image 타입: 이미지만 허용
        const allowedImageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/jpg",
        ];
        if (!allowedImageTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error: "이미지 파일만 업로드 가능합니다 (JPEG, PNG, GIF, WEBP)",
          });
        }
      } else {
        // file 타입: 모든 파일 허용 (일반적인 파일 형식만)
        const blockedMimeTypes = [
          "application/x-msdownload",
          "application/x-executable",
        ];
        if (blockedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error: "실행 파일은 업로드할 수 없습니다",
          });
        }
      }

      console.log(
        `📤 [미션 파일 업로드] 사용자 ${userId} - 타입: ${submissionType}, 파일명: ${req.file.originalname} (${req.file.mimetype})`,
      );

      // 모든 타입 원본 그대로 저장 (최적화 없음)
      const result = await saveFileToGCS(
        req.file.buffer,
        userId,
        "missions",
        req.file.originalname,
        req.file.mimetype,
      );

      console.log(
        `✅ [미션 ${submissionType} 업로드] GCS 원본 저장 완료: ${result.originalUrl}`,
      );

      res.json({
        success: true,
        fileUrl: result.originalUrl,
        thumbnailUrl: "", // 원본 보존 모드: 썸네일 없음
        gsPath: result.gsPath,
        fileName: result.fileName,
        mimeType: result.mimeType,
      });
    } catch (error) {
      console.error("❌ [미션 파일 업로드] 오류:", error);
      res.status(500).json({
        error: "파일 업로드 실패",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// 미션 파일 업로드 (제작소 제출용 - PDF, JPEG, WEBP 지원)
router.post(
  "/missions/upload-pdf",
  requireAuth,
  missionFileUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
      }

      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "사용자 인증 정보가 없습니다" });
      }

      // 허용된 파일 형식 검증 (PDF, JPEG, WEBP)
      const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/webp"];

      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res
          .status(400)
          .json({ error: "PDF, JPEG, WEBP 파일만 업로드 가능합니다" });
      }

      // 파일 크기 검증 (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res
          .status(400)
          .json({ error: "파일 크기는 50MB 이하여야 합니다" });
      }

      // 파일 형식에 따른 폴더 결정
      const isImage = req.file.mimetype.startsWith("image/");
      const folder = isImage ? "mission-images" : "mission-pdfs";
      const contentType = req.file.mimetype;

      console.log(
        `📤 [미션 파일 업로드] 사용자 ${userId} - 파일명: ${req.file.originalname}, 형식: ${contentType}`,
      );

      const result = await saveFileToGCS(
        req.file.buffer,
        userId,
        folder,
        req.file.originalname || "submission",
        contentType,
      );

      console.log(`✅ [미션 파일 업로드] GCS 저장 완료: ${result.originalUrl}`);

      res.json({
        success: true,
        pdfUrl: result.originalUrl,
        gsPath: result.gsPath,
        fileName: result.fileName,
      });
    } catch (error) {
      console.error("❌ [미션 파일 업로드] 오류:", error);
      res.status(500).json({
        error: "파일 업로드 실패",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// ============================================
// 액션 타입 관리 API
// ============================================

router.get("/action-types", requireAuth, requireAdminOrSuperAdmin, adminActionTypeController.getAllActionTypes);
router.get("/action-types/active", requireAuth, adminActionTypeController.getActiveActionTypes);
router.post("/action-types", requireAuth, requireAdminOrSuperAdmin, adminActionTypeController.createActionType);
router.patch("/action-types/:id", requireAuth, requireAdminOrSuperAdmin, adminActionTypeController.updateActionType);
router.delete("/action-types/:id", requireAuth, requireAdminOrSuperAdmin, adminActionTypeController.deleteActionType);
router.post("/action-types/reorder", requireAuth, requireAdminOrSuperAdmin, adminActionTypeController.reorderActionTypes);

// ============================================
// 출석 인증 & 기타 API
// ============================================

router.post("/sub-missions/:id/verify-attendance", requireAuth, userSubmissionController.verifyAttendance);
router.get("/theme-missions/:id/application-status", userMissionController.getApplicationStatus);

// ==========================================
// 📁 미션 폴더 관리 API (관리자용)
// ==========================================

router.get("/admin/mission-folders", requireAdminOrSuperAdmin, adminMissionFolderController.getAllFolders);
router.post("/admin/mission-folders", requireAdminOrSuperAdmin, adminMissionFolderController.createFolder);
router.put("/admin/mission-folders/reorder", requireAdminOrSuperAdmin, adminMissionFolderController.reorderFolders);
router.put("/admin/mission-folders/:id", requireAdminOrSuperAdmin, adminMissionFolderController.updateFolder);
router.delete("/admin/mission-folders/:id", requireAdminOrSuperAdmin, adminMissionFolderController.deleteFolder);

// ============================================
// 🏆 큰미션 관리 API (관리자용)
// ============================================

router.get("/admin/big-missions", requireAdminOrSuperAdmin, adminBigMissionController.getAllBigMissions);
router.get("/admin/big-missions/:id", requireAdminOrSuperAdmin, adminBigMissionController.getBigMissionById);
router.post("/admin/big-missions", requireAdminOrSuperAdmin, adminBigMissionController.createBigMission);
router.put("/admin/big-missions/:id", requireAdminOrSuperAdmin, adminBigMissionController.updateBigMission);
router.delete("/admin/big-missions/:id", requireAdminOrSuperAdmin, adminBigMissionController.deleteBigMission);
router.patch("/admin/big-missions/:id/toggle-active", requireAdminOrSuperAdmin, adminBigMissionController.toggleActive);

// 큰미션 토픽
router.post("/admin/big-missions/:bigMissionId/topics", requireAdminOrSuperAdmin, adminBigMissionController.createTopic);
router.put("/admin/big-missions/:bigMissionId/topics/:topicId", requireAdminOrSuperAdmin, adminBigMissionController.updateTopic);
router.delete("/admin/big-missions/:bigMissionId/topics/:topicId", requireAdminOrSuperAdmin, adminBigMissionController.deleteTopic);

export default router;
