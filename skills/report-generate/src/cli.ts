import { ReportFormatSchema, ReportTemplateSchema } from "@devscope/shared";
import { generateReport } from "./index.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

try {
  const raw = await readStdin();
  if (!raw) throw new Error("repo-analyze JSON is required on stdin");
  const template = ReportTemplateSchema.parse(option("--template", "investment"));
  const format = ReportFormatSchema.parse(option("--format", "markdown"));
  process.stdout.write(`${JSON.stringify(generateReport(JSON.parse(raw) as unknown, template, format))}\n`);
} catch (error) {
  process.stderr.write(`report-generate: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
