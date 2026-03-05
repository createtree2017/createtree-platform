import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { themeMissions, missionFolders } from "./shared/schema";
import { eq, isNull } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
    const nullMissions = await db.select().from(themeMissions).where(isNull(themeMissions.folderId));
    console.log('Null folder missions:', nullMissions.length);

    const folders = await db.select().from(missionFolders).where(eq(missionFolders.name, '개발자 전용')).limit(1);
    let devFolder = folders.length > 0 ? folders[0] : null;

    if (!devFolder) {
        console.log('Creating 개발자 전용 folder...');
        const [newFolder] = await db.insert(missionFolders).values({ name: '개발자 전용', order: 999 }).returning();
        devFolder = newFolder;
    } else {
        console.log('개발자 전용 folder exists with ID:', devFolder.id);
    }

    if (nullMissions.length > 0) {
        for (const m of nullMissions) {
            await db.update(themeMissions).set({ folderId: devFolder.id }).where(eq(themeMissions.id, m.id));
        }
        console.log(`Migrated ${nullMissions.length} missions to folder ID: ${devFolder.id}`);
    } else {
        console.log('No null folder missions to migrate.');
    }
}
main().catch(console.error).finally(() => process.exit(0));
