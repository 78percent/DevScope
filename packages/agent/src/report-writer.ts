import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

export interface ReportWriter {
  write(runId: string, markdown: string): Promise<string>;
}

export class FileReportWriter implements ReportWriter {
  public constructor(private readonly outputDirectory: string) {}

  public async write(runId: string, markdown: string): Promise<string> {
    await mkdir(this.outputDirectory, { recursive: true });
    const path = join(this.outputDirectory, `${runId}.md`);
    await writeFile(path, markdown, "utf8");
    return relative(process.cwd(), path).replace(/\\/g, "/");
  }
}
