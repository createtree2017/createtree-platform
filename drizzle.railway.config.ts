import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.RAILWAY_DATABASE_URL) {
  throw new Error("RAILWAY_DATABASE_URL이 설정되지 않았습니다.");
}

export default defineConfig({
  out: "./db/migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.RAILWAY_DATABASE_URL,
  },
  verbose: true,
});
