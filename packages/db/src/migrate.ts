import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const migrationsDirectory = fileURLToPath(new URL("../drizzle/", import.meta.url));
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://devscope:devscope@localhost:5433/devscope";
const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });

try {
  const migrationFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const migrationFile of migrationFiles) {
    const migrationSql = await readFile(new URL(`../drizzle/${migrationFile}`, import.meta.url), "utf8");
    await client.unsafe(migrationSql);
    console.log(`Applied ${migrationFile}`);
  }
} finally {
  await client.end();
}
