import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createRepositoryAnalyzer } from "@devscope/ai";
import { checkDatabaseConnection } from "@devscope/db";
import { buildApp } from "./app.js";

// pnpm/Turborepo 会把 API 的工作目录切到 apps/api，因此显式读取项目根目录 .env。
// 使用 import.meta.url 定位，避免依赖用户从哪个目录执行启动命令。
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

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
