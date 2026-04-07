import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(`
      ALTER TABLE "user_big_mission_progress" 
      ADD COLUMN IF NOT EXISTS "reward_status" varchar(20) DEFAULT 'not_eligible' NOT NULL,
      ADD COLUMN IF NOT EXISTS "reward_applied_at" timestamp,
      ADD COLUMN IF NOT EXISTS "reward_processed_at" timestamp;
    `);
    console.log("Migration successful:", result.command);
  } catch (err: any) {
    console.error("DB Error:", err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
