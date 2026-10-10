"use client";

import type { AppRouter } from "@devscope/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";

const labels = {
  daily_health: "每日健康报告",
  quick_assessment: "新项目快速评估",
  weekly_report: "每周汇总报告",
} as const;

export function WorkflowDashboard({ initialRepository }: { initialRepository?: string }) {
  const queryClient = useQueryClient();
  const client = useMemo(() => createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/trpc` })],
  }), []);
  const [repository, setRepository] = useState(initialRepository ?? "78percent/LangGraph_Trip_Planner");
  const [activeRunId, setActiveRunId] = useState<number | null>(null);

  useEffect(() => {
    if (initialRepository?.trim()) setRepository(initialRepository);
  }, [initialRepository]);

  const history = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => client.workflow.list.query({ limit: 12 }),
    refetchInterval: 5_000,
  });
  const activeRun = useQuery({
    queryKey: ["workflow-run", activeRunId],
    queryFn: () => client.workflow.status.query({ run_id: activeRunId as number }),
    enabled: activeRunId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1_000;
    },
  });

  const onStarted = (data: { run_id: number }) => {
    setActiveRunId(data.run_id);
    void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
  };
  const daily = useMutation({ mutationFn: () => client.workflow.startDaily.mutate(), onSuccess: onStarted });
  const quick = useMutation({ mutationFn: () => client.workflow.startQuick.mutate({ repository: repository.trim() }), onSuccess: onStarted });
  const weekly = useMutation({ mutationFn: () => client.workflow.startWeekly.mutate(), onSuccess: onStarted });
  const pending = daily.isPending || quick.isPending || weekly.isPending;
  const mutationError = daily.error ?? quick.error ?? weekly.error;
  const run = activeRun.data;

  return (
    <section className="mt-10 space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardTitle>每日健康报告</CardTitle>
          <p className="mt-2 text-sm text-slate-500">分析三个关注仓库、记录快照并生成健康度排名。</p>
          <Button className="mt-5" disabled={pending} onClick={() => daily.mutate()}>立即运行</Button>
        </Card>
        <Card>
          <CardTitle>新项目快速评估</CardTitle>
          <input className="mt-4 w-full rounded-md border px-3 py-2 text-sm" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repo 或 GitHub URL" />
          <Button className="mt-3" disabled={pending || !repository.trim()} onClick={() => quick.mutate()}>开始评估</Button>
        </Card>
        <Card>
          <CardTitle>每周汇总报告</CardTitle>
          <p className="mt-2 text-sm text-slate-500">汇总过去七天的日报、快速评估和最新排名。</p>
          <Button className="mt-5" disabled={pending} onClick={() => weekly.mutate()}>立即生成</Button>
        </Card>
      </div>

      {mutationError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mutationError.message}</p>}

      {run && <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{labels[run.type]} · #{run.id}</CardTitle>
          <StatusBadge status={run.status} />
        </div>
        <div className="mt-5 space-y-3">
          {run.steps.map((step) => <div key={step.key} className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
            <div>
              <p className="font-medium"><StepIcon status={step.status} /> {step.label}</p>
              {step.error && <p className="mt-1 text-red-700">{step.error}</p>}
            </div>
            <span className="shrink-0 text-xs text-slate-500">{step.status === "running" ? `第 ${step.attempt} 次尝试` : step.status}</span>
          </div>)}
        </div>
        {run.error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{run.error}</p>}
        {run.status === "completed" && <pre className="mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{formatOutput(run.output)}</pre>}
      </Card>}

      <Card>
        <CardTitle>最近运行</CardTitle>
        {history.isLoading && <p className="mt-3 text-sm text-slate-500">加载中…</p>}
        {history.error && <p className="mt-3 text-sm text-red-700">{history.error.message}</p>}
        <div className="mt-4 space-y-2">
          {history.data?.map((item) => <button key={item.id} className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm hover:bg-slate-50" onClick={() => setActiveRunId(item.id)}>
            <span>#{item.id} · {labels[item.type]}</span>
            <StatusBadge status={item.status} />
          </button>)}
        </div>
      </Card>
    </section>
  );
}

function StatusBadge({ status }: { status: "pending" | "running" | "completed" | "failed" }) {
  const style = status === "completed" ? "bg-emerald-100 text-emerald-800" : status === "failed" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800";
  const text = { pending: "等待中", running: "运行中", completed: "已完成", failed: "失败" }[status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{text}</span>;
}

function StepIcon({ status }: { status: "pending" | "running" | "completed" | "failed" }) {
  return <span aria-hidden>{status === "completed" ? "✓" : status === "failed" ? "×" : status === "running" ? "●" : "○"}</span>;
}

function formatOutput(output: unknown): string {
  if (output && typeof output === "object" && "report" in output && typeof output.report === "string") return output.report;
  if (output && typeof output === "object" && "executive_summary" in output && typeof output.executive_summary === "string") {
    return `${output.executive_summary}\n\n${JSON.stringify(output, null, 2)}`;
  }
  return JSON.stringify(output, null, 2);
}
