import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(
      `SELECT t.id, t.user_id, t.token, t.expires_at, t.used_at, t.created_at, 
              (t.expires_at > NOW()) as is_valid_now 
       FROM password_reset_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE u.email = 'imusiwqer1@gmail.com'
       ORDER BY t.created_at DESC LIMIT 5`
    );
    console.log("Tokens for imusiwqer1:", result.rows);
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
