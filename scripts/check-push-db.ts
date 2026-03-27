import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const userRes = await pool.query("SELECT id, email, is_system_push_agreed FROM users WHERE email = '9059056@gmail.com'");
    console.log("User:", userRes.rows);

    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;
      const deviceRes = await pool.query("SELECT id, is_active, created_at, device_token FROM user_devices WHERE user_id = $1", [userId]);
      console.log("Devices:", deviceRes.rows);

      const pushLogs = await pool.query("SELECT id, title, target_type, success_count, failure_count, status, created_at FROM push_delivery_logs ORDER BY created_at DESC LIMIT 5");
      console.log("Recent Push Logs:", pushLogs.rows);
    }
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
