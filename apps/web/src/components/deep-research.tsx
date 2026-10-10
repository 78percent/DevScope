"use client";

import type { AppRouter } from "@devscope/api";
import type { ResearchEvent, ResearchRun } from "@devscope/shared";
import { useMutation } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";

const eventTypes = ["phase", "tool_start", "tool_result", "source", "completed", "research_error"] as const;

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

export function DeepResearch() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const client = useMemo(() => createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: `${apiUrl}/trpc` })] }), [apiUrl]);
  const [topic, setTopic] = useState("TypeScript AI Agent 框架竞争格局");
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => () => streamRef.current?.close(), []);

  const start = useMutation({
    mutationFn: () => client.agent.startResearch.mutate({ topic: topic.trim() }),
    onSuccess: ({ run_id }) => {
      streamRef.current?.close();
      setEvents([]);
      setRun(null);
      setStreamError(null);
      const stream = new EventSource(`${apiUrl}/agent/research/${run_id}/events`);
      streamRef.current = stream;
      let terminalReceived = false;
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
        if (event.type === "completed" || event.type === "error") {
          terminalReceived = true;
          stream.close();
          try {
            setRun(await client.agent.status.query({ run_id }));
          } catch {
            setStreamError("研究已结束，但结果加载失败，请刷新页面后重试。");
          }
        }
      };
      for (const type of eventTypes) stream.addEventListener(type, (event) => { void receive(event); });
      stream.onopen = () => setStreamError(null);
      stream.onerror = () => {
        if (terminalReceived || checkingStatus) return;
        checkingStatus = true;
        void client.agent.status.query({ run_id }).then((latest) => {
          if (!latest) {
            setStreamError("没有找到这次研究任务，请重新运行。");
            stream.close();
            return;
          }
          setEvents(latest.events);
          if (latest.status === "completed" || latest.status === "failed") {
            terminalReceived = true;
            setRun(latest);
            setStreamError(null);
            stream.close();
          }
        }).catch(() => {
          setStreamError("无法读取研究进度，请稍后重新运行。");
          stream.close();
        }).finally(() => {
          checkingStatus = false;
        });
      };
    },
  });

  const running = start.isPending || (events.length > 0 && !events.some((event) => event.type === "completed" || event.type === "error"));

  return (
    <section className="mt-12 space-y-6">
      <Card>
        <CardTitle>自主深度研究 Agent</CardTitle>
        <p className="mt-2 text-sm text-slate-500">输入技术主题，Agent 将自主检索 GitHub、Hacker News 和论文，并生成带来源的竞争格局报告。</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="例如：TypeScript AI Agent 框架竞争格局"
          />
          <Button disabled={running || topic.trim().length < 3} onClick={() => start.mutate()}>
            {running ? "研究中…" : "开始深度研究"}
          </Button>
        </div>
        {start.error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{start.error.message}</p>}
        {streamError && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{streamError}</p>}
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

      {run?.status === "failed" && <Card>
        <CardTitle>研究未完成</CardTitle>
        <p className="mt-3 text-sm text-red-700">{run.error ?? "研究过程中发生错误，请重新运行。"}</p>
      </Card>}

      {run?.report && <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>竞争格局研究报告</CardTitle>
          <span className="text-xs text-slate-500">{run.report.report_path}</span>
        </div>
        <pre className="mt-5 max-h-[42rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-5 text-xs leading-6 text-slate-100">{run.report.markdown}</pre>
        <div className="mt-5">
          <p className="text-sm font-semibold">数据来源</p>
          <ul className="mt-2 space-y-1 text-sm">
            {run.report.sources.map((source) => <li key={source.url}><a className="text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}
          </ul>
        </div>
      </Card>}
    </section>
  );
}
