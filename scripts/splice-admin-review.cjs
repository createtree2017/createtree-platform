const fs = require('fs');

const FILE_PATH = 'server/routes/mission-routes.ts';
const content = fs.readFileSync(FILE_PATH, 'utf-8');
const lines = content.split('\n');

let importInserted = false;

// 1. imports
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('AdminMissionReviewController')) {
    importInserted = true;
  }
  if (lines[i].includes('const userSubmissionController = new UserSubmissionController();') && !importInserted) {
    lines.splice(i-1, 0, 'import { AdminMissionReviewController } from "../controllers/admin/admin.mission.review.controller";');
    lines.splice(i + 3, 0, 'const adminMissionReviewController = new AdminMissionReviewController();');
    importInserted = true;
    break;
  }
}

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 관리자 - 검수 API') && startIndex === -1) {
    startIndex = i;
  }
  if (lines[i].includes('// ============================================') && lines[i+1] && lines[i+1].includes('// 미션 파일 업로드 API (사용자용)')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1 && importInserted) {
  const newRoutes = `// ============================================
// 관리자 - 검수 API
// ============================================

router.get("/admin/review/theme-missions", requireAdminOrSuperAdmin, adminMissionReviewController.getThemeMissionsWithStats);
router.get("/admin/review/theme-missions/:missionId/sub-missions", requireAdminOrSuperAdmin, adminMissionReviewController.getSubMissionsWithStats);
router.get("/admin/review/submissions", requireAdminOrSuperAdmin, adminMissionReviewController.getSubmissions);
router.post("/admin/review/submissions/:submissionId/approve", requireAdminOrSuperAdmin, adminMissionReviewController.approveSubmission);
router.post("/admin/review/submissions/:submissionId/reject", requireAdminOrSuperAdmin, adminMissionReviewController.rejectSubmission);
router.patch("/admin/review/submissions/status", requireAdminOrSuperAdmin, adminMissionReviewController.updateSubmissionStatus);
router.get("/admin/review/dashboard/recent-activities", requireAdminOrSuperAdmin, adminMissionReviewController.getRecentActivities);

`;

  // Safely splice array
  lines.splice(startIndex, endIndex - startIndex, ...newRoutes.split('\n'));
  
  fs.writeFileSync(FILE_PATH, lines.join('\n'));
  console.log('Successfully spliced Admin Review logic.');
} else {
  console.error('Failed to find markers in mission-routes.ts');
  console.log({ startIndex, endIndex, importInserted });
}
