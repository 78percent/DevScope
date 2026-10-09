import { RagDemo } from "../components/rag-demo";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-14">
      <p className="mb-2 text-sm font-medium text-blue-700">DevScope · Day 2</p>
      <h1 className="text-4xl font-bold tracking-tight">开源项目语义研究</h1>
      <p className="mt-3 max-w-2xl text-slate-600">采集 GitHub 与 Hacker News 资料，通过千问 Embedding 和 pgvector 检索，再由大模型根据来源回答。</p>
      <RagDemo />
    </main>
  );
}
