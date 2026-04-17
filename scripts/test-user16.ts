import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(
      `SELECT id, username, email FROM users WHERE id = 16`
    );
    console.log("User 16:", result.rows[0]);
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
