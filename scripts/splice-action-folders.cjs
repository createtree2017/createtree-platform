const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

let importInsertedAdminAction = false;
let importInsertedAdminFolder = false;

// 1. imports
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('AdminActionTypeController')) importInsertedAdminAction = true;
  if (lines[i].includes('AdminMissionFolderController')) importInsertedAdminFolder = true;
  
  if (lines[i].includes('const adminMissionReviewController = new AdminMissionReviewController();')) {
    if (!importInsertedAdminAction) {
      lines.splice(i-1, 0, 'import { AdminActionTypeController } from "../controllers/admin/admin.action.type.controller";');
      lines.splice(i + 1, 0, 'const adminActionTypeController = new AdminActionTypeController();');
      importInsertedAdminAction = true;
      i += 2; // adjust index
    }
    if (!importInsertedAdminFolder) {
      lines.splice(i-1, 0, 'import { AdminMissionFolderController } from "../controllers/admin/admin.mission.folder.controller";');
      lines.splice(i + 1, 0, 'const adminMissionFolderController = new AdminMissionFolderController();');
      importInsertedAdminFolder = true;
      i += 2; // adjust index
    }
    break;
  }
}

let startIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 액션 타입 관리 API') && startIndex === -1) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  const newRoutes = `// ============================================
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

export default router;
`;

  lines.splice(startIndex, lines.length - startIndex, ...newRoutes.split('\n'));
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced Action Types and Folders logic.');
} else {
  console.error('Failed to find markers in mission-routes.ts');
}
