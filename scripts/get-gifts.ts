import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT 
        p.id as progress_id, 
        b.title, 
        b.gift_items, 
        b.gift_image_url, 
        b.gift_description 
      FROM user_big_mission_progress p
      JOIN big_missions b ON p.big_mission_id = b.id
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
