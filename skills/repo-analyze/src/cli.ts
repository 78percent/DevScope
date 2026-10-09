import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createRepositoryAnalyzer } from "@devscope/ai";
import { analyzeFetchedRepository } from "./index.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

try {
  const raw = await readStdin();
  if (!raw) throw new Error("repo-fetch JSON is required on stdin");
  const result = await analyzeFetchedRepository(createRepositoryAnalyzer(), JSON.parse(raw) as unknown);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`repo-analyze: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
