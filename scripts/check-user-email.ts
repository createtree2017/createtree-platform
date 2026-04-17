import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result1 = await pool.query("SELECT id, username, email FROM users WHERE email = $1", ["ct.createtree@gmail.com"]);
    console.log("ct.createtree@gmail.com is in DB:", result1.rows);
    
    const result2 = await pool.query("SELECT id, username, email FROM users WHERE email = $1", ["imusiwer@gmail.com"]);
    console.log("imusiwer@gmail.com is in DB:", result2.rows);
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
