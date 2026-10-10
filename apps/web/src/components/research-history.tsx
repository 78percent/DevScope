"use client";

import type { AppRouter } from "@devscope/api";
import type { ResearchRun, WorkflowRun } from "@devscope/shared";
import { useQuery } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useMemo, useState } from "react";
import { MarkdownReport } from "./markdown-report";
import { Card, CardTitle } from "./ui/card";

export function ResearchHistory() {
  const client = useMemo(() => createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/trpc` })] }), []);
  const [selectedResearch, setSelectedResearch] = useState<ResearchRun | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<{ id: number; output?: unknown } | null>(null);
  const research = useQuery({ queryKey: ["research-history"], queryFn: () => client.agent.listResearch.query({ limit: 20 }) });
  const workflows = useQuery({ queryKey: ["workflow-history"], queryFn: () => client.workflow.list.query({ limit: 20 }) });

  return <div className="grid gap-6 lg:grid-cols-2">
    <Card>
      <CardTitle>深度研究历史</CardTitle>
      <HistoryState loading={research.isLoading} error={research.error?.message} empty={!research.data?.length} />
      <div className="mt-4 space-y-2">{research.data?.map((item) => <button key={item.id} className="w-full rounded-lg border px-4 py-3 text-left text-sm hover:bg-slate-50" onClick={() => { setSelectedResearch(item); setSelectedWorkflow(null); }}><div className="flex justify-between gap-3"><span className="font-medium">{item.topic}</span><span className="shrink-0 text-slate-500">{statusText(item.status)}</span></div><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("zh-CN")}</p></button>)}</div>
    </Card>
    <Card>
      <CardTitle>固定工作流历史</CardTitle>
      <HistoryState loading={workflows.isLoading} error={workflows.error?.message} empty={!workflows.data?.length} />
      <div className="mt-4 space-y-2">{workflows.data?.map((item) => <button key={item.id} className="w-full rounded-lg border px-4 py-3 text-left text-sm hover:bg-slate-50" onClick={() => { setSelectedWorkflow(item); setSelectedResearch(null); }}><div className="flex justify-between gap-3"><span className="font-medium">#{item.id} · {workflowText(item.type)}</span><span className="text-slate-500">{statusText(item.status)}</span></div><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("zh-CN")}</p></button>)}</div>
    </Card>
    {selectedResearch && <Card className="lg:col-span-2"><CardTitle>{selectedResearch.topic}</CardTitle>{selectedResearch.report ? <div className="mt-4"><MarkdownReport markdown={selectedResearch.report.markdown} /></div> : selectedResearch.checkpoint ? <div className="mt-4"><MarkdownReport markdown={selectedResearch.checkpoint.summary} /></div> : <p className="mt-3 text-sm text-slate-500">这次任务尚未产生可查看的内容。</p>}</Card>}
    {selectedWorkflow && <Card className="lg:col-span-2"><CardTitle>工作流 #{selectedWorkflow.id}</CardTitle><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selectedWorkflow.output, null, 2)}</pre></Card>}
  </div>;
}

function HistoryState({ loading, error, empty }: { loading: boolean; error: string | undefined; empty: boolean }) {
  if (loading) return <p className="mt-3 text-sm text-slate-500">加载中…</p>;
  if (error) return <p className="mt-3 text-sm text-red-700">{error}</p>;
  if (empty) return <p className="mt-3 text-sm text-slate-500">暂无记录。</p>;
  return null;
}

function statusText(status: string) {
  return ({ pending: "等待中", collecting: "采集中", awaiting_review: "待确认", generating: "生成中", running: "运行中", completed: "已完成", failed: "失败", cancelled: "已停止" } as Record<string, string>)[status] ?? status;
}

function workflowText(type: WorkflowRun["type"]) {
  return ({ daily_health: "每日健康报告", quick_assessment: "快速评估", weekly_report: "每周汇总" })[type];
}
