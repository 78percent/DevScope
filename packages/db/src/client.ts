import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabase(databaseUrl = process.env.DATABASE_URL ?? "postgresql://devscope:devscope@localhost:5432/devscope") {
  const client = postgres(databaseUrl, { max: 5 });
  return { client, db: drizzle(client, { schema }) };
}

export async function checkDatabaseConnection(databaseUrl?: string): Promise<boolean> {
  const { client } = createDatabase(databaseUrl);
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.end();
  }
}
