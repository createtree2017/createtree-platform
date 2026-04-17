import "dotenv/config";
import { db } from "../shared/schema"; // Actually Drizzle db is in @db?
// Let's use @db
import { db as drizzleDb } from "../server/db"; // Let's check path. It's import { db } from "@db" in auth.ts. Wait, in scripts we can use what apply-reward-schema used. 

// I will just fetch it directly from the local pg
import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const userResult = await pool.query("SELECT id, email FROM users WHERE email = $1", ["ct.createtree@gmail.com"]);
    const user = userResult.rows[0];
    if (!user) throw new Error("User not found");
    
    console.log("Found user:", user);
    
    // Simulate updating old tokens
    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [user.id]);
    console.log("Updated old tokens");
    
    // Simulate inserting new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await pool.query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)", [user.id, token, expiresAt]);
    console.log("Inserted new token:", token);
    
  } catch (err) {
    console.error("Error during flow:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
