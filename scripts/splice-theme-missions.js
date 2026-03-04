const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

// 1. Insert import and initialization at line 35
let importInserted = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const adminMissionCategoryController')) {
    lines.splice(i + 1, 0, 'import { AdminMissionThemeController } from "../controllers/admin/admin.mission.theme.controller";', 'const adminMissionThemeController = new AdminMissionThemeController();');
    importInserted = true;
    break;
  }
}

// 2. Find start and end of Theme Missions block to replace
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// 미션 헤더 이미지 업로드') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 관리자 - 하부미션 관리 API')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1 && importInserted) {
  const newRoutes = `// 미션 헤더 이미지 업로드
router.post(
  "/admin/missions/upload-header",
  requireAdminOrSuperAdmin,
  missionHeaderUpload.single("headerImage"),
  adminMissionThemeController.uploadHeaderImage
);

// 미션 순서 업데이트 (드래그앤드롭)
router.put(
  "/admin/missions/reorder",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.reorderMissions
);

// 주제 미션 목록 조회 (필터링 지원)
router.get(
  "/admin/missions",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.getAdminMissions
);

// 주제 미션 상세 조회
router.get(
  "/admin/missions/:missionId",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.getMissionById
);

// 주제 미션 생성
router.post(
  "/admin/missions",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.createMission
);

// 주제 미션 수정
router.put(
  "/admin/missions/:id",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.updateMission
);

// 주제 미션 삭제
router.delete(
  "/admin/missions/:id",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.deleteMission
);

// 주제 미션 복사
router.post(
  "/admin/missions/:id/duplicate",
  requireAdminOrSuperAdmin,
  adminMissionThemeController.duplicateMission
);
`;

  // Remove lines from startIndex to endIndex - 1
  lines.splice(startIndex, endIndex - startIndex, newRoutes);
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced mission-routes.ts for Theme Missions');
} else {
  console.error('Failed to find markers in mission-routes.ts');
  console.log({ startIndex, endIndex, importInserted });
}
