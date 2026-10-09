# repo-analyze

从 stdin 读取 `repo-fetch` JSON，调用配置好的结构化仓库分析器，并向 stdout 输出符合 `RepoAnalyzeResultSchema` 的纯 JSON。解析、模型或校验错误写入 stderr。

```powershell
Get-Content repo.json -Raw | pnpm --silent skill:analyze
```
