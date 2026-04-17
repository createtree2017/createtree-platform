import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query("SELECT NOW(), CURRENT_TIMESTAMP");
    console.log("DB NOW():", result.rows[0].now);
    console.log("Current KST Node Time:", new Date().toString());
    console.log("Current Node UTC Time:", new Date().toISOString());
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
