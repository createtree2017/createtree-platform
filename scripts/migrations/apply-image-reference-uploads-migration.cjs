require("dotenv/config");

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const rootDir = path.resolve(__dirname, "../..");
const migrationPath = path.join(rootDir, "db", "migrations", "20260430_create_image_reference_uploads.sql");

function getSslConfig(databaseUrl) {
  if (databaseUrl.includes("railway.internal")) {
    return false;
  }

  return { rejectUnauthorized: false };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL이 설정되어 있지 않습니다.");
  }

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`마이그레이션 파일을 찾을 수 없습니다: ${migrationPath}`);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 10000,
    ssl: getSslConfig(databaseUrl),
  });

  const client = await pool.connect();

  try {
    const before = await client.query(`
      SELECT
        current_database() AS database_name,
        current_user AS user_name,
        to_regclass('public.images') AS images_table,
        to_regclass('public.image_reference_uploads') AS reference_table
    `);

    console.log("[사전 확인]", JSON.stringify(before.rows[0], null, 2));

    if (!before.rows[0].images_table) {
      throw new Error("public.images 테이블이 없어 마이그레이션을 중단합니다.");
    }

    const sql = fs.readFileSync(migrationPath, "utf8");
    await client.query(sql);

    const tableCheck = await client.query(`
      SELECT to_regclass('public.image_reference_uploads') AS reference_table
    `);

    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'image_reference_uploads'
      ORDER BY indexname
    `);

    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'image_reference_uploads'
      ORDER BY ordinal_position
    `);

    const requiredIndexes = [
      "image_reference_uploads_created_at_idx",
      "image_reference_uploads_generated_image_id_idx",
      "image_reference_uploads_status_idx",
      "image_reference_uploads_storage_path_idx",
      "image_reference_uploads_user_id_idx",
    ];

    const existingIndexNames = indexCheck.rows.map((row) => row.indexname);
    const missingIndexes = requiredIndexes.filter((name) => !existingIndexNames.includes(name));
    const storagePathIndex = indexCheck.rows.find((row) => row.indexname === "image_reference_uploads_storage_path_idx");

    if (!tableCheck.rows[0].reference_table) {
      throw new Error("image_reference_uploads 테이블 생성 확인에 실패했습니다.");
    }

    if (missingIndexes.length > 0) {
      throw new Error(`필수 인덱스 누락: ${missingIndexes.join(", ")}`);
    }

    if (!storagePathIndex?.indexdef.includes("UNIQUE")) {
      throw new Error("storage_path 인덱스가 UNIQUE로 생성되지 않았습니다.");
    }

    console.log("[적용 후 테이블]", JSON.stringify(tableCheck.rows[0], null, 2));
    console.log("[적용 후 인덱스]", JSON.stringify(indexCheck.rows, null, 2));
    console.log("[적용 후 컬럼]", JSON.stringify(columnCheck.rows, null, 2));
    console.log("[완료] image_reference_uploads 단일 마이그레이션 적용 및 검증 완료");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[마이그레이션 실패]", error.message);
  process.exit(1);
});
