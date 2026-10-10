"use client";

import type { AppRouter } from "@devscope/api";
import { useQuery } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useMemo } from "react";
import { HealthTrendChart } from "./health-trend-chart";
import { Card, CardTitle } from "./ui/card";

export function WatchlistPanel() {
  const client = useMemo(() => createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/trpc` })] }), []);
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: () => client.workflow.watchlist.query() });
  return <section className="mt-12">
    <Card>
      <CardTitle>关注项目监控</CardTitle>
      <p className="mt-2 text-sm text-slate-500">每日工作流会为这些仓库保存健康度快照。</p>
      {watchlist.error && <p className="mt-3 text-sm text-red-700">{watchlist.error.message}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{watchlist.data?.map((repository) => <a key={`${repository.owner}/${repository.name}`} className="rounded-lg border p-4 text-sm font-medium hover:bg-slate-50" href={`https://github.com/${repository.owner}/${repository.name}`} target="_blank" rel="noreferrer">{repository.owner}/{repository.name}</a>)}</div>
    </Card>
    <HealthTrendChart />
  </section>;
}
