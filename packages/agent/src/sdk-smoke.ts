import { resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "dotenv";
import { createAgentEnvironment } from "./environment.js";

const projectRoot = resolve(import.meta.dirname, "../../..");
config({ path: resolve(projectRoot, ".env"), quiet: true });
const environment = createAgentEnvironment(process.env);
let result = "";

for await (const message of query({
  prompt: "Reply with exactly: DEVScope Agent SDK ready",
  options: {
    cwd: projectRoot,
    env: environment.processEnv,
    model: environment.model,
    maxTurns: 1,
    tools: [],
    permissionMode: "dontAsk",
    settingSources: [],
  },
})) {
  if (message.type === "result" && message.subtype === "success") result = message.result;
}

if (!result) throw new Error("Agent SDK smoke test returned no result");
process.stdout.write(`${result.trim()}\n`);
