"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@devscope/api";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";

const demoInput = {
  repository: { owner: "vercel", name: "next.js", url: "https://github.com/vercel/next.js", description: "The React Framework for the Web", primary_language: "TypeScript", stars: 130_000, forks: 28_000, open_issues: 2_000, archived: false },
  metrics: { stars_growth_rate: 0.0125, issue_resolution_rate: 0.72, active_contributors_90d: 180, contributor_diversity: 88 },
};

export function AnalysisDemo() {
  const client = useMemo(() => createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/trpc` })] }), []);
  const [result, setResult] = useState<Awaited<ReturnType<typeof client.analysis.analyzeRepository.mutate>> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setError("");
    try { setResult(await client.analysis.analyzeRepository.mutate(demoInput)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "分析请求失败"); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>输入快照</CardTitle>
        <p className="mt-2 text-sm text-slate-500">vercel/next.js · 演示数据</p>
        <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(demoInput.metrics, null, 2)}</pre>
        <Button className="mt-5" onClick={analyze} disabled={loading}>{loading ? "分析中…" : "运行结构化分析"}</Button>
      </Card>
      <Card>
        <CardTitle>结构化输出</CardTitle>
        {!result && !error && <p className="mt-4 text-sm text-slate-500">点击按钮后显示通过 Zod 校验的结果。</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {result && <pre className="mt-4 overflow-auto rounded-lg bg-emerald-950 p-4 text-xs text-emerald-50">{JSON.stringify(result, null, 2)}</pre>}
      </Card>
    </div>
  );
}
