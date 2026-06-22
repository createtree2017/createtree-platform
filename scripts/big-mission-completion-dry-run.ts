import { db, pool } from "@db";
import {
  bigMissions,
  userBigMissionProgress,
  users,
  hospitals,
  bigMissionTopics,
} from "@shared/schema";
import {
  BIG_MISSION_PROGRESS_STATUS,
  bigMissionProgressService,
} from "../server/services/mission/big-mission-progress.service";
import { desc, eq } from "drizzle-orm";

type DryRunRow = {
  progressId: number;
  userId: number;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  hospitalName: string | null;
  bigMissionId: number;
  missionTitle: string;
  currentStatus: string;
  currentCompletedTopics: number;
  currentTotalTopics: number;
  newStatus: string;
  newCompletedTopics: number;
  newTotalTopics: number;
  rewardStatus: string;
  rewardAppliedAt: Date | null;
  reviewType: string | null;
};

function formatDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

async function main() {
  const progressRows = await db
    .select({
      progressId: userBigMissionProgress.id,
      userId: userBigMissionProgress.userId,
      bigMissionId: userBigMissionProgress.bigMissionId,
      currentStatus: userBigMissionProgress.status,
      currentCompletedTopics: userBigMissionProgress.completedTopics,
      currentTotalTopics: userBigMissionProgress.totalTopics,
      rewardStatus: userBigMissionProgress.rewardStatus,
      rewardAppliedAt: userBigMissionProgress.rewardAppliedAt,
      missionTitle: bigMissions.title,
      userName: users.fullName,
      userPhone: users.phoneNumber,
      userEmail: users.email,
      hospitalName: hospitals.name,
    })
    .from(userBigMissionProgress)
    .innerJoin(bigMissions, eq(userBigMissionProgress.bigMissionId, bigMissions.id))
    .innerJoin(users, eq(userBigMissionProgress.userId, users.id))
    .leftJoin(hospitals, eq(users.hospitalId, hospitals.id))
    .orderBy(desc(userBigMissionProgress.updatedAt));

  const reportRows: DryRunRow[] = [];

  for (const row of progressRows) {
    const mission = await db.query.bigMissions.findFirst({
      where: eq(bigMissions.id, row.bigMissionId),
      with: {
        topics: {
          where: eq(bigMissionTopics.isActive, true),
        },
      },
    });

    if (!mission) {
      continue;
    }

    const newProgress = await bigMissionProgressService.calculateMissionProgress(row.userId, mission);
    const wasCompleted = row.currentStatus === BIG_MISSION_PROGRESS_STATUS.COMPLETED;
    const isNowCompleted = newProgress.status === BIG_MISSION_PROGRESS_STATUS.COMPLETED;
    const hasRewardApplication = row.rewardStatus === "pending" || row.rewardStatus === "approved";

    let reviewType: string | null = null;
    if (wasCompleted && !isNowCompleted) {
      reviewType = "완료->미완료";
    }
    if (hasRewardApplication && !isNowCompleted) {
      reviewType = row.rewardStatus === "pending"
        ? "pending 보상 운영취소 검토"
        : "approved 보상 수동검토";
    }

    reportRows.push({
      progressId: row.progressId,
      userId: row.userId,
      userName: row.userName,
      userPhone: row.userPhone,
      userEmail: row.userEmail,
      hospitalName: row.hospitalName,
      bigMissionId: row.bigMissionId,
      missionTitle: row.missionTitle,
      currentStatus: row.currentStatus,
      currentCompletedTopics: row.currentCompletedTopics,
      currentTotalTopics: row.currentTotalTopics,
      newStatus: newProgress.status,
      newCompletedTopics: newProgress.completedTopics,
      newTotalTopics: newProgress.totalTopics,
      rewardStatus: row.rewardStatus,
      rewardAppliedAt: row.rewardAppliedAt,
      reviewType,
    });
  }

  const downshiftRows = reportRows.filter(row =>
    row.currentStatus === BIG_MISSION_PROGRESS_STATUS.COMPLETED &&
    row.newStatus !== BIG_MISSION_PROGRESS_STATUS.COMPLETED
  );

  const rewardReviewRows = reportRows.filter(row =>
    (row.rewardStatus === "pending" || row.rewardStatus === "approved") &&
    row.newStatus !== BIG_MISSION_PROGRESS_STATUS.COMPLETED
  );

  console.log("=== 나의미션 완료 기준 보정 dry-run ===");
  console.log(`전체 progress rows: ${reportRows.length}`);
  console.log(`완료에서 미완료로 내려갈 대상: ${downshiftRows.length}`);
  console.log(`보상 신청 취소/수동검토 대상: ${rewardReviewRows.length}`);
  console.log("");

  console.log("=== 완료에서 미완료로 내려갈 대상 ===");
  console.table(downshiftRows.map(row => ({
    progressId: row.progressId,
    userId: row.userId,
    userName: row.userName,
    phone: row.userPhone,
    email: row.userEmail,
    hospital: row.hospitalName,
    mission: row.missionTitle,
    current: `${row.currentCompletedTopics}/${row.currentTotalTopics} ${row.currentStatus}`,
    next: `${row.newCompletedTopics}/${row.newTotalTopics} ${row.newStatus}`,
    rewardStatus: row.rewardStatus,
    rewardAppliedAt: formatDate(row.rewardAppliedAt),
  })));

  console.log("=== 보상 신청 취소/수동검토 대상 ===");
  console.table(rewardReviewRows.map(row => ({
    progressId: row.progressId,
    userId: row.userId,
    userName: row.userName,
    phone: row.userPhone,
    email: row.userEmail,
    hospital: row.hospitalName,
    mission: row.missionTitle,
    rewardStatus: row.rewardStatus,
    reviewType: row.reviewType,
    current: `${row.currentCompletedTopics}/${row.currentTotalTopics} ${row.currentStatus}`,
    next: `${row.newCompletedTopics}/${row.newTotalTopics} ${row.newStatus}`,
    rewardAppliedAt: formatDate(row.rewardAppliedAt),
  })));
}

main()
  .catch((error) => {
    console.error("dry-run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
