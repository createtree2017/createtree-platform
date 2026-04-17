import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
// We need the schema from shared/schema.ts
import * as schema from "../shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool, { schema });

async function main() {
  try {
    const tokens = await db.select().from(schema.passwordResetTokens).limit(5);
    if (tokens.length === 0) {
      console.log("No tokens");
      return;
    }
    
    // Pick the token we made earlier that expires in the future
    const tokenStr = "b540ca6cc8aaddb1648d0d26932c540be96877552b6ee89da5ed44c00fe0a022";
    
    // Reset its used_at to test correctly
    await pool.query("UPDATE password_reset_tokens SET used_at = NULL WHERE token = $1", [tokenStr]);
    
    console.log("Testing with new Date()...");
    const query1 = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(schema.passwordResetTokens.token, tokenStr),
        sql`${schema.passwordResetTokens.usedAt} IS NULL`,
        sql`${schema.passwordResetTokens.expiresAt} > ${new Date()}`
      )
    });
    console.log("Found with JS Date()?:", !!query1);

    console.log("Testing with NOW()...");
    const query2 = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(schema.passwordResetTokens.token, tokenStr),
        sql`${schema.passwordResetTokens.usedAt} IS NULL`,
        sql`${schema.passwordResetTokens.expiresAt} > NOW()`
      )
    });
    console.log("Found with NOW()?:", !!query2);
    
  } catch (err) {
    console.error("error:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
