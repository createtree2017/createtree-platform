import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const result = await pool.query(
      'SELECT menu_id, title, path, is_active, "order" FROM main_menus ORDER BY "order"'
    );
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", (err as any).message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
