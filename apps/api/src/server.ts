import "dotenv/config";
import { createRepositoryAnalyzer } from "@devscope/ai";
import { checkDatabaseConnection } from "@devscope/db";
import { buildApp } from "./app.js";

const app = await buildApp({ analyzer: createRepositoryAnalyzer(), databaseReady: () => checkDatabaseConnection() });
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
  console.log(`DevScope API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
