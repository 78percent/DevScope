"use client";

import type { AppRouter } from "@devscope/api";
import { useMutation } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardTitle } from "./ui/card";

export function RagDemo() {
  const client = useMemo(() => createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/trpc` })],
  }), []);
  const [owner, setOwner] = useState("vercel");
  const [name, setName] = useState("next.js");
  const [query, setQuery] = useState("这个项目解决什么问题？主要技术特点是什么？");

  const ingest = useMutation({ mutationFn: () => client.rag.ingestRepository.mutate({ owner: owner.trim(), name: name.trim() }) });
  const search = useMutation({ mutationFn: () => client.rag.search.mutate({ query: query.trim(), repository: { owner: owner.trim(), name: name.trim() }, limit: 5 }) });

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>1. 采集仓库知识</CardTitle>
        <p className="mt-2 text-sm text-slate-500">采集仓库元数据、README 和相关 Hacker News 讨论，生成向量后写入 pgvector。</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">Owner<input className="mt-1 w-full rounded-md border px-3 py-2 font-normal" value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
          <label className="text-sm font-medium">Repository<input className="mt-1 w-full rounded-md border px-3 py-2 font-normal" value={name} onChange={(event) => setName(event.target.value)} /></label>
        </div>
        <Button className="mt-5" disabled={ingest.isPending || !owner.trim() || !name.trim()} onClick={() => ingest.mutate()}>{ingest.isPending ? "采集中…" : "采集并写入知识库"}</Button>
        {ingest.error && <p className="mt-3 text-sm text-red-700">{ingest.error.message}</p>}
        {ingest.data && <p className="mt-3 text-sm text-emerald-700">已写入 {ingest.data.chunks_stored} 个文本块（README {ingest.data.sources.readme}，HN {ingest.data.sources.hacker_news}）。</p>}
      </Card>

      <Card>
        <CardTitle>2. RAG 语义问答</CardTitle>
        <textarea className="mt-4 min-h-28 w-full rounded-md border px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button className="mt-3" disabled={search.isPending || !query.trim()} onClick={() => search.mutate()}>{search.isPending ? "检索并回答中…" : "开始语义搜索"}</Button>
        {search.error && <p className="mt-3 text-sm text-red-700">{search.error.message}</p>}
      </Card>

      {search.data && <Card className="lg:col-span-2">
        <CardTitle>回答</CardTitle>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">{search.data.answer}</p>
        <h3 className="mt-6 font-semibold">检索来源</h3>
        <ol className="mt-3 space-y-3">
          {search.data.sources.map((source, index) => <li key={source.id} className="rounded-lg border p-3 text-sm">
            <a className="font-medium text-blue-700 hover:underline" href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.title}</a>
            <p className="mt-1 text-xs text-slate-500">{source.source_type} · 相似度 {source.similarity.toFixed(3)}</p>
            <p className="mt-2 line-clamp-3 text-slate-600">{source.content}</p>
          </li>)}
        </ol>
      </Card>}
    </div>
  );
}
