import "dotenv/config";
import { Pool } from "pg";

console.log("Starting DB check...");
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log("Connecting to pool...");
    const res = await pool.query("SELECT id, username, member_type FROM users LIMIT 10");
    console.log("Query completed.");
    console.log("Users found:", res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));
    
    const adminRes = await pool.query("SELECT id, username, member_type FROM users WHERE member_type IN ('admin', 'superadmin') LIMIT 1");
    console.log("Admin search result:", JSON.stringify(adminRes.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", (err as any).message);
    if ((err as any).stack) console.error((err as any).stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
