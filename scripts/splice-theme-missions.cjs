const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

let importInserted = false;

// 1. imports
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('AdminMissionThemeController')) {
    importInserted = true;
  }
  if (lines[i].includes('const router = Router();') && !importInserted) {
    lines.splice(i, 0, 
      'import { AdminMissionCategoryController } from "../controllers/admin/admin.mission.category.controller";',
      'import { AdminMissionThemeController } from "../controllers/admin/admin.mission.theme.controller";',
      ''
    );
    i += 3; // Shift i since we inserted 3 lines
    lines.splice(i + 1, 0, 
      'const adminMissionCategoryController = new AdminMissionCategoryController();',
      'const adminMissionThemeController = new AdminMissionThemeController();',
      ''
    );
    importInserted = true;
    break;
  }
}

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 관리자 - 미션 카테고리 관리 API') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 관리자 - 하부미션 관리 API')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1 && importInserted) {
  const newRoutes = `// ============================================
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
// 관리자 - 주제 미션 CRUD API
// ============================================

router.put("/admin/missions/reorder", requireAdminOrSuperAdmin, adminMissionThemeController.reorderMissions);
router.get("/admin/missions", requireAdminOrSuperAdmin, adminMissionThemeController.getAdminMissions);
router.get("/admin/missions/:missionId", requireAdminOrSuperAdmin, adminMissionThemeController.getMissionById);
router.post("/admin/missions", requireAdminOrSuperAdmin, adminMissionThemeController.createMission);
router.put("/admin/missions/:id", requireAdminOrSuperAdmin, adminMissionThemeController.updateMission);
router.delete("/admin/missions/:id", requireAdminOrSuperAdmin, adminMissionThemeController.deleteMission);
router.post("/admin/missions/:id/duplicate", requireAdminOrSuperAdmin, adminMissionThemeController.duplicateMission);
`;

  lines.splice(startIndex, endIndex - startIndex, newRoutes);
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced mission-routes.ts exactly between Category and Sub-Missions boundaries.');
} else {
  console.error('Failed to find markers in mission-routes.ts');
  console.log({ startIndex, endIndex, importInserted });
}
