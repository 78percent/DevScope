"use client";

import { useState } from "react";
import { DeepResearch } from "./deep-research";
import { ResearchHistory } from "./research-history";
import { Button } from "./ui/button";
import { WorkflowDashboard } from "./workflow-dashboard";

type Tab = "quick" | "deep" | "history";

export function AnalysisWorkspace() {
  const [tab, setTab] = useState<Tab>("quick");
  const [query, setQuery] = useState("78percent/LangGraph_Trip_Planner");
  const [submitted, setSubmitted] = useState(query);

  const open = (next: Exclude<Tab, "history">) => {
    setSubmitted(query.trim());
    setTab(next);
  };

  return <section className="mt-10 space-y-6">
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <label className="text-sm font-semibold" htmlFor="home-search">输入 GitHub 仓库或研究主题</label>
      <div className="mt-3 flex flex-col gap-3 md:flex-row">
        <input id="home-search" className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="owner/repo，或要研究的技术主题" />
        <Button disabled={!query.trim()} onClick={() => open("quick")}>快速分析</Button>
        <Button disabled={query.trim().length < 3} variant="outline" onClick={() => open("deep")}>深度研究</Button>
      </div>
    </div>

    <nav className="flex gap-2 border-b" aria-label="分析页面">
      {(["quick", "deep", "history"] as const).map((item) => <button key={item} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === item ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`} onClick={() => setTab(item)}>{({ quick: "快速分析", deep: "深度研究", history: "历史记录" })[item]}</button>)}
    </nav>

    {tab === "quick" && <WorkflowDashboard initialRepository={submitted} />}
    {tab === "deep" && <DeepResearch initialTopic={submitted} />}
    {tab === "history" && <ResearchHistory />}
  </section>;
}
