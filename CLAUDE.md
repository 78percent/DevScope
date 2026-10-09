# DevScope 开发约定

- 只实现当前 Day 的验收内容，优先最小可运行方案。
- 入口层为 `apps/*` 和 `skills/*`，业务流程放在 `packages/core`，公共契约放在 `packages/shared`。
- 所有外部输入先经过 Zod；模型输出也必须再次校验。
- CLI 的 `stdout` 只能输出 JSON，错误和诊断信息写入 `stderr`。
- 不提交 `.env`、API Key、Token、密码或真实密钥输出。
- 修改后运行直接相关的类型检查和 Vitest，不维护开发日志或逐轮总结。

常用命令：`pnpm typecheck`、`pnpm test`、`pnpm db:migrate`、`pnpm dev`。
