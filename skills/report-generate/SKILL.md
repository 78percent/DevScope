# report-generate

从 stdin 读取 `repo-analyze` JSON，使用 `--template daily|weekly|investment` 和 `--format markdown|html` 生成报告。stdout 始终是符合 `GeneratedReportSchema` 的 JSON，其中 `content` 保存报告正文。

```powershell
Get-Content analysis.json -Raw | pnpm --silent skill:report -- --template investment --format markdown
```
