import { RagDemo } from "../components/rag-demo";
import { WorkflowDashboard } from "../components/workflow-dashboard";
import { HealthTrendChart } from "../components/health-trend-chart";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-14">
      <p className="mb-2 text-sm font-medium text-blue-700">DevScope · Day 4</p>
      <h1 className="text-4xl font-bold tracking-tight">开源项目情报工作台</h1>
      <p className="mt-3 max-w-3xl text-slate-600">运行每日健康报告、项目快速评估和每周汇总，实时查看固定工作流的执行步骤与结果。</p>
      <WorkflowDashboard />
      <HealthTrendChart />
      <div className="mt-14 border-t pt-10">
        <h2 className="text-2xl font-bold">RAG 语义研究</h2>
        <p className="mt-2 text-sm text-slate-600">保留 Day 2 的真实 GitHub、Hacker News、千问 Embedding 与 pgvector 检索能力。</p>
      </div>
      <RagDemo />
    </main>
  );
}
