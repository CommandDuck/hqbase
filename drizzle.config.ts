import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  migrations: {
    prefix: "timestamp"
  },
  out: "./migrations/drizzle",
  schema: "./worker/db/schema.ts",
  strict: true,
  verbose: true
});
