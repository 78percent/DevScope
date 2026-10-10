import { RagDemo } from "../components/rag-demo";
import { AnalysisWorkspace } from "../components/analysis-workspace";
import { WatchlistPanel } from "../components/watchlist-panel";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-14">
      <p className="mb-2 text-sm font-medium text-blue-700">DevScope · Day 6</p>
      <h1 className="text-4xl font-bold tracking-tight">开源项目情报工作台</h1>
      <p className="mt-3 max-w-3xl text-slate-600">快速分析仓库，或让多名 Agent 分工研究一个技术主题；最终报告由你确认研究方向后生成。</p>
      <AnalysisWorkspace />
      <WatchlistPanel />
      <div className="mt-14 border-t pt-10">
        <h2 className="text-2xl font-bold">RAG 语义研究</h2>
        <p className="mt-2 text-sm text-slate-600">保留 Day 2 的真实 GitHub、Hacker News、千问 Embedding 与 pgvector 检索能力。</p>
      </div>
      <RagDemo />
    </main>
  );
}
