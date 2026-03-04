const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

let importInserted = false;

// 1. imports
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('AdminMissionSubController')) {
    importInserted = true;
  }
  if (lines[i].includes('const adminMissionThemeController = new AdminMissionThemeController();') && !importInserted) {
    lines.splice(i-1, 0, 'import { AdminMissionSubController } from "../controllers/admin/admin.mission.sub.controller";');
    lines.splice(i + 2, 0, 'const adminMissionSubController = new AdminMissionSubController();');
    importInserted = true;
    break;
  }
}

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 관리자 - 하부미션 관리 API') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 사용자 - 미션 목록 및 상세 API')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1 && importInserted) {
  const newRoutes = `// ============================================
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
`;

  lines.splice(startIndex, endIndex - startIndex, newRoutes);
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced Admin Sub & Child Missions logic.');
} else {
  console.error('Failed to find markers in mission-routes.ts');
  console.log({ startIndex, endIndex, importInserted });
}
