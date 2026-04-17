import { db } from "../db/index.ts";
import { users, userBigMissionProgress, bigMissions, hospitals } from "../shared/schema.ts";
import { eq, desc, inArray } from "drizzle-orm";

async function run() {
    try {
        let query = db.select({
            id: userBigMissionProgress.id,
            userId: userBigMissionProgress.userId,
            bigMissionId: userBigMissionProgress.bigMissionId,
            rewardStatus: userBigMissionProgress.rewardStatus,
            rewardAppliedAt: userBigMissionProgress.rewardAppliedAt,
            rewardProcessedAt: userBigMissionProgress.rewardProcessedAt,
            missionTitle: bigMissions.title,
            giftImageUrl: bigMissions.giftImageUrl,
            giftDescription: bigMissions.giftDescription,
            giftItems: bigMissions.giftItems,
            userName: users.fullName,
            userPhone: users.phoneNumber,
            userEmail: users.email,
            hospitalName: hospitals.name
        })
        .from(userBigMissionProgress)
        .innerJoin(bigMissions, eq(userBigMissionProgress.bigMissionId, bigMissions.id))
        .innerJoin(users, eq(userBigMissionProgress.userId, users.id))
        .leftJoin(hospitals, eq(users.hospitalId, hospitals.id));

        query = query.where(
            inArray(userBigMissionProgress.rewardStatus, ['pending', 'approved'])
        ) as any;

        const applications = await query.orderBy(desc(userBigMissionProgress.rewardAppliedAt));
        console.log("SUCCESS:", applications.length);
    } catch (err) {
        console.error("FAILED Drizzle Query:");
        console.error(err);
    }
    process.exit(0);
}
run();
