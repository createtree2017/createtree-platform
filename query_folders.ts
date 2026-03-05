import { db } from "./server/db";
import { missionFolders, themeMissions } from "./shared/schema";

async function main() {
    const folders = await db.select().from(missionFolders);
    console.log("Folders:", folders);

    const missions = await db.select({ title: themeMissions.title, folderId: themeMissions.folderId, visibilityType: themeMissions.visibilityType }).from(themeMissions);
    console.log("Missions:", missions);
}

main().catch(console.error).then(() => process.exit(0));
