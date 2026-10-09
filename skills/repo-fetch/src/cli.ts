import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { GitHubCliSource } from "@devscope/sources";
import { fetchRepository, parseFetchArguments } from "./index.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

try {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const parsed = parseFetchArguments(process.argv.slice(2));
  const reference = parsed.reference ?? await readStdin();
  if (!reference) throw new Error("repository is required as owner/repo, GitHub URL, or stdin");
  const result = await fetchRepository(new GitHubCliSource({ token }), reference, parsed.options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`repo-fetch: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
