import { db } from "@db";
import { themeMissions, userMissionProgress, MISSION_STATUS } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

export async function countAllMissions(missionId: number): Promise<number> {
  const children = await db.query.themeMissions.findMany({
    where: and(
      eq(themeMissions.parentMissionId, missionId),
      eq(themeMissions.isActive, true),
    ),
  });

  let count = 1;
  for (const child of children) {
    count += await countAllMissions(child.id);
  }
  return count;
}

export interface MissionTreeNode {
  id: number;
  missionId: string;
  title: string;
  depth: number;
  status: string;
  isUnlocked: boolean;
  children: MissionTreeNode[];
}

export async function buildMissionTree(
  missionId: number,
  userId: number,
  depth: number = 1,
): Promise<MissionTreeNode> {
  const mission = await db.query.themeMissions.findFirst({
    where: eq(themeMissions.id, missionId),
  });

  if (!mission) {
    throw new Error("Mission not found");
  }

  const progress = await db.query.userMissionProgress.findFirst({
    where: and(
      eq(userMissionProgress.userId, userId),
      eq(userMissionProgress.themeMissionId, missionId),
    ),
  });

  let isUnlocked = true;
  if (mission.parentMissionId) {
    const parentProgress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.parentMissionId),
        eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
      ),
    });
    isUnlocked = !!parentProgress;

    if (isUnlocked) {
      const parentMission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId),
      });

      if (parentMission?.parentMissionId) {
        const parentSiblings = await db.query.themeMissions.findMany({
          where: and(
            eq(themeMissions.parentMissionId, parentMission.parentMissionId),
            eq(themeMissions.isActive, true),
          ),
        });

        for (const sibling of parentSiblings) {
          const siblingProgress = await db.query.userMissionProgress.findFirst({
            where: and(
              eq(userMissionProgress.userId, userId),
              eq(userMissionProgress.themeMissionId, sibling.id),
              eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
            ),
          });
          if (!siblingProgress) {
            isUnlocked = false;
            break;
          }
        }
      }
    }
  }

  const children = await db.query.themeMissions.findMany({
    where: and(
      eq(themeMissions.parentMissionId, missionId),
      eq(themeMissions.isActive, true),
    ),
    orderBy: [asc(themeMissions.order), asc(themeMissions.id)],
  });

  const childTrees = await Promise.all(
    children.map((child) => buildMissionTree(child.id, userId, depth + 1)),
  );

  return {
    id: mission.id,
    missionId: mission.missionId,
    title: mission.title,
    depth,
    status: progress?.status || MISSION_STATUS.NOT_STARTED,
    isUnlocked,
    children: childTrees,
  };
}
