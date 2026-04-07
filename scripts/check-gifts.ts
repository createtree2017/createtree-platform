import "dotenv/config";
import { db } from "../server/db/index.ts";
import { bigMissions, userBigMissionProgress } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function run() {
    const apps = await db.select({
        id: userBigMissionProgress.id,
        missionTitle: bigMissions.title,
        giftItems: bigMissions.giftItems,
        giftImageUrl: bigMissions.giftImageUrl,
        giftDescription: bigMissions.giftDescription
    })
    .from(userBigMissionProgress)
    .innerJoin(bigMissions, eq(userBigMissionProgress.bigMissionId, bigMissions.id));
    
    console.log(JSON.stringify(apps, null, 2));
    process.exit(0);
}
run();
