const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

let importInserted = false;

// 1. imports
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('UserSubmissionController')) {
    importInserted = true;
  }
  if (lines[i].includes('const userMissionController = new UserMissionController();') && !importInserted) {
    lines.splice(i-1, 0, 'import { UserSubmissionController } from "../controllers/user/user.submission.controller";');
    lines.splice(i + 3, 0, 'const userSubmissionController = new UserSubmissionController();');
    importInserted = true;
    break;
  }
}

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 사용자 - 세부 미션 제출 API') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 관리자 - 검수 API')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1 && importInserted) {
  const newRoutes = `// ============================================
// 사용자 - 세부 미션 제출 API
// ============================================

router.post("/missions/:missionId/start", requireAuth, userSubmissionController.startMission);
router.post("/missions/:missionId/sub-missions/:subMissionId/submit", requireAuth, userSubmissionController.submitSubMission);
router.delete("/missions/:missionId/sub-missions/:subMissionId/submission", requireAuth, userSubmissionController.cancelSubmission);
router.post("/missions/:missionId/sub-missions/:subMissionId/cancel-application", requireAuth, userSubmissionController.cancelApplication);
router.post("/missions/:missionId/complete", requireAuth, userSubmissionController.completeMission);

`;

  // Safely splice array
  lines.splice(startIndex, endIndex - startIndex, ...newRoutes.split('\n'));
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced User Submissions logic.');
} else {
  console.error('Failed to find markers in mission-routes.ts');
  console.log({ startIndex, endIndex, importInserted });
}
