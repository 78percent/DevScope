import { AnalysisDemo } from "../components/analysis-demo";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-14">
      <p className="mb-2 text-sm font-medium text-blue-700">DevScope · Day 1</p>
      <h1 className="text-4xl font-bold tracking-tight">GitHub 仓库健康度分析</h1>
      <p className="mt-3 max-w-2xl text-slate-600">当前页面使用固定仓库快照验收 Web → tRPC → 分析器 → Zod 的完整调用链。Day 2 再接 GitHub 实时采集。</p>
      <AnalysisDemo />
    </main>
  );
}
