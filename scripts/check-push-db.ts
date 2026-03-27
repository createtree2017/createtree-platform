import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const pushLogs = await pool.query("SELECT id, title, target_type, success_count, failure_count, status, created_at FROM push_delivery_logs ORDER BY created_at DESC LIMIT 5");
    console.log("Recent Push Logs:", pushLogs.rows);
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
