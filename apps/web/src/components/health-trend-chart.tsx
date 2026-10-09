"use client";

import type { AppRouter } from "@devscope/api";
import { useQuery } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardTitle } from "./ui/card";

const colors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

export function HealthTrendChart() {
  const client = useMemo(() => createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/trpc` })],
  }), []);
  const trends = useQuery({
    queryKey: ["health-trends", 30],
    queryFn: () => client.workflow.healthTrends.query({ days: 30 }),
    refetchInterval: 30_000,
  });
  const repositories = [...new Set(trends.data?.points.map((point) => point.repository) ?? [])];
  const data = trends.data?.points.map((point) => ({
    time: new Date(point.date).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    [point.repository]: point.health_score,
  })) ?? [];

  return <Card className="mt-6">
    <CardTitle>最近 30 天健康度趋势</CardTitle>
    <p className="mt-2 text-sm text-slate-500">数据来自工作流保存的真实健康度分析记录。</p>
    {trends.isLoading && <p className="mt-6 text-sm text-slate-500">加载趋势数据…</p>}
    {trends.error && <p className="mt-6 text-sm text-red-700">{trends.error.message}</p>}
    {!trends.isLoading && !trends.error && data.length === 0 && <p className="mt-6 text-sm text-slate-500">暂无分析记录，请先运行每日健康报告或快速评估。</p>}
    {data.length > 0 && <div className="mt-6 h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {repositories.map((repository, index) => <Line key={repository} type="monotone" dataKey={repository} stroke={colors[index % colors.length] ?? "#2563eb"} strokeWidth={2} connectNulls dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>}
  </Card>;
}
