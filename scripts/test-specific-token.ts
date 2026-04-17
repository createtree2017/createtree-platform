import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const tokenStr = "6eb0c0630a6785f143d3ad2068ef5e97968782c40e829474710a2ce1393817a3";
    const result = await pool.query(
      "SELECT id, user_id, token, expires_at, used_at, created_at, (expires_at > NOW()) as is_valid_now FROM password_reset_tokens WHERE token = $1",
      [tokenStr]
    );
    console.log("Token Details:", result.rows[0]);
    
    // Also let's see how many tokens this user generated today
    if (result.rows.length > 0) {
      const uid = result.rows[0].user_id;
      const history = await pool.query(
        "SELECT id, expires_at, used_at, created_at FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
        [uid]
      );
      console.log("\nHistory for this user:");
      history.rows.forEach(r => console.log(r));
    }
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
