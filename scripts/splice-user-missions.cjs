const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

let importInserted = false;

// 1. imports
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('UserMissionController')) {
    importInserted = true;
  }
  if (lines[i].includes('const adminMissionThemeController = new AdminMissionThemeController();') && !importInserted) {
    lines.splice(i-1, 0, 'import { UserMissionController } from "../controllers/user/user.mission.controller";');
    lines.splice(i + 3, 0, 'const userMissionController = new UserMissionController();');
    importInserted = true;
    break;
  }
}

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 사용자 - 미션 목록 및 상세 API') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 사용자 - 세부 미션 제출 API')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1 && importInserted) {
  const newRoutes = `// ============================================
// 사용자 - 미션 목록 및 상세 API
// ============================================

router.get("/missions/my", requireAuth, userMissionController.getMyParticipatedMissions);
router.get("/missions", requireAuth, userMissionController.getPublicMissions);
router.get("/missions/:parentId/child-missions", requireAuth, userMissionController.getChildMissions);
router.get("/missions/history", requireAuth, userMissionController.getMissionHistory);
router.get("/missions/:missionId", requireAuth, userMissionController.getMissionDetail);
router.get("/my-missions", requireAuth, userMissionController.getMyMissions);
`;

  lines.splice(startIndex, endIndex - startIndex, newRoutes);
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced User Missions logic.');
} else {
  console.error('Failed to find markers in mission-routes.ts');
  console.log({ startIndex, endIndex, importInserted });
}
