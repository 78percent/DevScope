import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import { createDefaultResearchAgent } from "./factory.js";

const projectRoot = resolve(import.meta.dirname, "../../..");
config({ path: resolve(projectRoot, ".env"), quiet: true });

const topic = process.argv.slice(2).join(" ").trim();
if (!topic) {
  process.stderr.write("agent:research: topic is required\n");
  process.exitCode = 1;
} else {
  try {
    const report = await createDefaultResearchAgent(projectRoot).run(randomUUID(), topic, (event) => {
      process.stderr.write(`${JSON.stringify(event)}\n`);
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(`agent:research: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
