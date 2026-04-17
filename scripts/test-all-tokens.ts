import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(
      "SELECT id, user_id, token, expires_at, used_at, created_at FROM password_reset_tokens ORDER BY created_at DESC LIMIT 5"
    );
    console.log("LAST 5 TOKENS:");
    result.rows.forEach(r => console.log(r));
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
