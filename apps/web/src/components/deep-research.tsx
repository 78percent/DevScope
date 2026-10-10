"use client";

import type { AppRouter } from "@devscope/api";
import type { ResearchEvent, ResearchRun } from "@devscope/shared";
import { useMutation } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownReport } from "./markdown-report";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";

const eventTypes = [
  "phase", "tool_start", "tool_result", "source", "agent_start", "agent_result",
  "awaiting_review", "reviewed", "completed", "cancelled", "research_error",
] as const;

function parseResearchEvent(data: string): ResearchEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== "object") return null;
    const event = value as Partial<ResearchEvent>;
    if (typeof event.id !== "number" || typeof event.run_id !== "string" || typeof event.type !== "string" || typeof event.message !== "string" || typeof event.timestamp !== "string") return null;
    return event as ResearchEvent;
  } catch {
    return null;
  }
}

export function DeepResearch({ initialTopic }: { initialTopic?: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const client = useMemo(() => createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: `${apiUrl}/trpc` })] }), [apiUrl]);
  const [topic, setTopic] = useState(initialTopic ?? "TypeScript AI Agent 框架竞争格局");
  const [guidance, setGuidance] = useState("");
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (initialTopic?.trim()) setTopic(initialTopic);
  }, [initialTopic]);
  useEffect(() => () => streamRef.current?.close(), []);

  const loadRun = useCallback(async (runId: string) => {
    const latest = await client.agent.status.query({ run_id: runId });
    if (!latest) throw new Error("没有找到这次研究任务");
    setRun(latest);
    setEvents(latest.events);
    return latest;
  }, [client]);

  const connect = useCallback((runId: string, afterEventId = -1) => {
    streamRef.current?.close();
    setStreamError(null);
    const suffix = afterEventId >= 0 ? `?after=${afterEventId}` : "";
    const stream = new EventSource(`${apiUrl}/agent/research/${runId}/events${suffix}`);
    streamRef.current = stream;
    let streamFinished = false;
    let checkingStatus = false;
    const receive = async (raw: Event) => {
      if (!(raw instanceof MessageEvent) || typeof raw.data !== "string" || raw.data.trim() === "") return;
      const event = parseResearchEvent(raw.data);
      if (!event) {
        setStreamError("收到的研究进度格式不正确，请重新运行。");
        stream.close();
        return;
      }
      setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event]);
      if (["awaiting_review", "completed", "cancelled", "error"].includes(event.type)) {
        streamFinished = true;
        stream.close();
        try {
          await loadRun(runId);
        } catch {
          setStreamError("研究阶段已结束，但结果加载失败，请刷新后重试。");
        }
      }
    };
    for (const type of eventTypes) stream.addEventListener(type, (event) => { void receive(event); });
    stream.onopen = () => setStreamError(null);
    stream.onerror = () => {
      if (streamFinished || checkingStatus) return;
      checkingStatus = true;
      void loadRun(runId).then((latest) => {
        if (["awaiting_review", "completed", "failed", "cancelled"].includes(latest.status)) {
          streamFinished = true;
          setStreamError(null);
          stream.close();
        }
      }).catch(() => {
        setStreamError("无法读取研究进度，请稍后重新运行。");
        stream.close();
      }).finally(() => { checkingStatus = false; });
    };
  }, [apiUrl, loadRun]);

  const start = useMutation({
    mutationFn: () => client.agent.startResearch.mutate({ topic: topic.trim() }),
    onSuccess: ({ run_id }) => {
      setEvents([]);
      setRun(null);
      setGuidance("");
      connect(run_id);
    },
  });
  const review = useMutation({
    mutationFn: (input: { action: "continue" | "adjust" | "stop"; guidance?: string }) => {
      if (!run) throw new Error("研究任务不存在");
      return client.agent.reviewResearch.mutate({ run_id: run.id, ...input });
    },
    onSuccess: (latest) => {
      setRun(latest);
      setEvents(latest.events);
      if (latest.status === "generating") connect(latest.id, latest.events.at(-1)?.id ?? -1);
    },
  });

  const active = start.isPending || run?.status === "pending" || run?.status === "collecting" || run?.status === "generating" || (events.length > 0 && run === null);

  return (
    <section className="space-y-6">
      <Card>
        <CardTitle>自主深度研究 Agent</CardTitle>
        <p className="mt-2 text-sm text-slate-500">多名 Agent 分头收集仓库、社区和论文资料，先展示中间结果，由你确认后再生成最终报告。</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：TypeScript AI Agent 框架竞争格局" />
          <Button disabled={active || topic.trim().length < 3} onClick={() => start.mutate()}>{active ? "研究中…" : "开始深度研究"}</Button>
        </div>
        {start.error && <ErrorMessage message={start.error.message} />}
        {streamError && <ErrorMessage message={streamError} />}
      </Card>

      {events.length > 0 && <Card>
        <CardTitle>Agent 执行轨迹</CardTitle>
        <div className="mt-4 max-h-80 space-y-2 overflow-auto">
          {events.map((event) => <div key={event.id} className="flex gap-3 rounded-md border px-3 py-2 text-sm">
            <span className="shrink-0 text-xs text-slate-400">#{event.id + 1}</span>
            <span className={event.type === "error" ? "text-red-700" : "text-slate-700"}>{event.message}</span>
          </div>)}
        </div>
      </Card>}

      {run?.status === "awaiting_review" && run.checkpoint && <Card>
        <CardTitle>中间研究结果</CardTitle>
        <p className="mt-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900"><strong>研究计划：</strong>{run.checkpoint.plan}</p>
        <div className="mt-4 rounded-lg border bg-white p-5"><MarkdownReport markdown={run.checkpoint.summary} /></div>
        <label className="mt-5 block text-sm font-medium">可选：告诉 Agent 需要补充或调整的方向</label>
        <textarea className="mt-2 min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="例如：更关注部署成本和中文生态" />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={review.isPending} onClick={() => review.mutate({ action: "continue" })}>确认并生成报告</Button>
          <Button disabled={review.isPending || guidance.trim().length < 3} variant="outline" onClick={() => review.mutate({ action: "adjust", guidance: guidance.trim() })}>按意见调整后生成</Button>
          <Button disabled={review.isPending} variant="outline" onClick={() => review.mutate({ action: "stop" })}>停止任务</Button>
        </div>
        {review.error && <ErrorMessage message={review.error.message} />}
      </Card>}

      {run?.status === "failed" && <Card><CardTitle>研究未完成</CardTitle><p className="mt-3 text-sm text-red-700">{run.error ?? "研究过程中发生错误，请重新运行。"}</p></Card>}
      {run?.status === "cancelled" && <Card><CardTitle>研究已停止</CardTitle><p className="mt-3 text-sm text-slate-600">中间结果已保留，可在历史记录中查看。</p></Card>}

      {run?.report && <Card className="research-report-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>竞争格局研究报告</CardTitle>
          <div className="flex items-center gap-3"><span className="text-xs text-slate-500">{run.report.report_path}</span><Button variant="outline" onClick={() => window.print()}>导出 PDF</Button></div>
        </div>
        <div className="mt-5 rounded-lg border bg-white p-5"><MarkdownReport markdown={run.report.markdown} /></div>
        <div className="mt-5"><p className="text-sm font-semibold">数据来源</p><ul className="mt-2 space-y-1 text-sm">{run.report.sources.map((source) => <li key={source.url}><a className="text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></div>
      </Card>}
    </section>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>;
}
