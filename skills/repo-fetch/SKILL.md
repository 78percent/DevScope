# repo-fetch

采集 GitHub 仓库数据。输入为位置参数、GitHub URL 或 stdin；可使用 `--include-issues` 和 `--include-commits`。成功时 stdout 只输出符合 `RepoFetchResultSchema` 的 JSON，错误写入 stderr 并返回非零退出码。

```powershell
"78percent/LangGraph_Trip_Planner" | pnpm --silent skill:fetch -- --include-issues --include-commits
```
