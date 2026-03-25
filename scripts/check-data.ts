import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT id, title, growth_enabled, growth_tree_name, growth_stage_images
      FROM big_missions
      ORDER BY id DESC LIMIT 5;
    `);
    console.log("Recent Big Missions:");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
