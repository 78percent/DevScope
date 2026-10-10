# DevScope

> 面向开发者的开源项目情报工作台：分析 GitHub 仓库、追踪项目健康度，并用多 Agent 研究技术生态与竞争格局。

DevScope 把仓库数据采集、RAG 语义检索、项目健康评估、定时工作流和深度研究 Agent 放进同一个 Web 工作台。你可以快速分析一个 GitHub 仓库，也可以给出技术主题，让多个研究 Agent 分工收集仓库、社区与论文证据，在人工确认方向后生成带来源的 Markdown 报告。

## 核心能力

- **仓库快速评估**：采集 GitHub 指标与 README，分析代码质量、社区活跃度、风险和竞品。
- **项目健康监控**：维护关注列表，生成每日健康排名、每周汇总和 30 天趋势图。
- **RAG 语义研究**：把仓库资料切分、向量化并保存到 pgvector，支持语义检索与带来源回答。
- **多 Agent 深度研究**：仓库采集 Agent 与社区研究 Agent 并行工作，再由竞品 Agent 汇总比较。
- **Human-in-the-loop**：先展示中间研究结果，等待人工确认或补充指导，再生成最终报告。
- **过程可观察**：通过 SSE 展示研究阶段和 Agent 进度，任务状态与报告写入 PostgreSQL。
- **可复用 Skills**：提供 `repo-fetch`、`repo-analyze`、`report-generate` 三个独立 CLI Skill。

## 研究流程

```mermaid
flowchart TD
    A[输入仓库或研究主题] --> B{选择模式}
    B -->|快速分析| C[采集 GitHub 数据]
    C --> D[质量 / 社区 / 风险 / 竞品分析]
    D --> E[保存快照与报告]

    B -->|深度研究| F[研究协调器]
    F --> G[仓库采集 Agent]
    F --> H[社区与论文 Agent]
    G --> I[竞品对比 Agent]
    H --> I
    I --> J[人工审核研究方向]
    J --> K[报告 Agent]
    K --> L[带来源的 Markdown 报告]
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Web | Next.js 15、React 19、Tailwind CSS、TanStack Query、Recharts |
| API | Fastify、tRPC、Zod、SuperJSON |
| Agent / AI | Claude Agent SDK、Anthropic SDK、DeepSeek Anthropic 兼容接口 |
| 数据采集 | Octokit、GitHub API、Hacker News |
| RAG | 千问 Embedding、文本切分、pgvector |
| 数据库 | PostgreSQL 16、Drizzle ORM |
| 工程 | TypeScript、pnpm workspace、Turborepo、Vitest |

## Monorepo 结构

```text
DevScope/
├─ apps/
│  ├─ web/                 # Next.js 情报工作台
│  └─ api/                 # Fastify + tRPC API、SSE 与调度器
├─ packages/
│  ├─ agent/               # 多 Agent 研究、任务管理与报告写入
│  ├─ ai/                  # 模型、Embedding、RAG 回答与仓库分析
│  ├─ core/                # RAG、工作流、重试等业务流程
│  ├─ db/                  # Drizzle schema、存储实现与 SQL 迁移
│  ├─ shared/              # Zod 契约和共享类型
│  └─ sources/             # GitHub、Hacker News 等数据源
├─ skills/
│  ├─ repo-fetch/          # 仓库数据采集 Skill
│  ├─ repo-analyze/        # 结构化仓库分析 Skill
│  └─ report-generate/     # Markdown / HTML 报告生成 Skill
└─ docker-compose.yml      # 本地 PostgreSQL + pgvector
```

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 11.25.0
- Docker / Docker Compose
- GitHub Token
- 使用真实 AI 能力时，需要对应的 DeepSeek / DashScope / Claude Agent SDK 环境凭据

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```dotenv
AI_MODE=mock
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_API_KEY=

GITHUB_TOKEN=
DASHSCOPE_API_KEY=
DATABASE_URL=postgresql://devscope:devscope@localhost:5433/devscope

API_HOST=127.0.0.1
API_PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

`AI_MODE=mock` 适合先验收本地流程；启动完整 API 时仍需要 `GITHUB_TOKEN` 采集仓库数据。请勿把 `.env` 或任何真实 Token 提交到仓库。

### 3. 启动数据库并迁移

```bash
pnpm db:up
pnpm db:migrate
```

Compose 默认把 pgvector/PostgreSQL 暴露到本机 `5433`，避免与常见的本机 `5432` 实例冲突。

### 4. 启动应用

```bash
pnpm dev
```

- Web：<http://localhost:3000>
- API：<http://127.0.0.1:4000>

## 常用命令

```bash
pnpm dev             # 启动所有开发服务
pnpm build           # 构建 / 检查各 workspace
pnpm typecheck       # TypeScript 类型检查
pnpm test            # 运行 Vitest 测试
pnpm test:coverage   # 生成测试覆盖率
pnpm db:up           # 启动 pgvector/PostgreSQL
pnpm db:down         # 停止本地容器
pnpm db:migrate      # 执行数据库迁移
```

## 独立 Skills

三个 CLI Skill 都遵循同一约定：成功结果以 JSON 写到 `stdout`，错误和诊断写到 `stderr`，方便继续拼接自动化流程。

```powershell
# 1. 采集仓库信息
"78percent/LangGraph_Trip_Planner" |
  pnpm --silent skill:fetch -- --include-issues --include-commits

# 2. 分析采集结果
Get-Content repo.json -Raw | pnpm --silent skill:analyze

# 3. 生成报告
Get-Content analysis.json -Raw |
  pnpm --silent skill:report -- --template investment --format markdown
```

## 数据与可信度设计

- 外部输入和模型输出都经过 Zod 校验。
- 最终研究报告只能使用检查点中已收集的证据与 URL。
- 深度研究在最终成文前保留人工审核节点，可补充指导或终止任务。
- 工作流步骤、重试次数、仓库快照、研究检查点与最终报告均可持久化。
- RAG 回答返回检索来源，避免只给出无法追溯的结论。

## 当前状态

DevScope 目前是持续迭代中的个人 AI 工程项目，已经覆盖从采集、分析、检索、工作流到多 Agent 报告生成的完整链路。默认关注列表与部分运行配置仍面向本地演示，若用于多人或公网环境，需要继续补充身份认证、权限隔离、任务队列和生产部署配置。
