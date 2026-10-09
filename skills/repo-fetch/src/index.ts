import { RepoFetchOptionsSchema, parseRepositoryReference, type RepoFetchOptions, type RepoFetchResult } from "@devscope/shared";
import type { CliRepositorySource } from "@devscope/sources";

export function parseFetchArguments(args: string[]): { reference?: string; options: RepoFetchOptions } {
  const flags = new Set(args.filter((argument) => argument.startsWith("--")));
  const reference = args.find((argument) => !argument.startsWith("--"));
  return {
    ...(reference ? { reference } : {}),
    options: RepoFetchOptionsSchema.parse({
      include_issues: flags.has("--include-issues"),
      include_commits: flags.has("--include-commits"),
    }),
  };
}

export async function fetchRepository(source: CliRepositorySource, reference: string, options: RepoFetchOptions): Promise<RepoFetchResult> {
  return source.fetch(parseRepositoryReference(reference), RepoFetchOptionsSchema.parse(options));
}
