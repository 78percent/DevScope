import type { RepositoryAnalyzer } from "@devscope/ai";
import type { WorkflowStore } from "@devscope/db";
import {
  QuickAssessmentReportSchema,
  type CompetitorRepository,
  type RepositoryAnalysis,
  type RepositoryAnalysisInput,
  type RepositorySnapshot,
  type RepositoryTarget,
  type WorkflowRun,
  parseRepositoryReference,
} from "@devscope/shared";
import type { RepositorySourceCollector, SourceDocument, WorkflowRepositorySource } from "@devscope/sources";
import { withRetry } from "./retry.js";

const dailySteps = [
  { key: "load_watchlist", label: "读取关注列表" },
  { key: "analyze_repositories", label: "采集并分析仓库" },
  { key: "rank", label: "健康度排名" },
  { key: "generate_report", label: "生成每日报告" },
];

const quickSteps = [
  { key: "collect", label: "信息采集" },
  { key: "code_quality", label: "代码质量分析" },
  { key: "community", label: "社区活跃度分析" },
  { key: "competitors", label: "竞品分析" },
  { key: "risk", label: "风险评估" },
  { key: "final_report", label: "生成最终报告" },
];

const weeklySteps = [
  { key: "collect_history", label: "读取本周记录" },
  { key: "aggregate", label: "汇总趋势与风险" },
  { key: "generate_report", label: "生成每周报告" },
];

export interface WorkflowService {
  startDailyHealth(): Promise<number>;
  startQuickAssessment(repository: string): Promise<number>;
  startWeeklyReport(): Promise<number>;
  getRun(runId: number): Promise<WorkflowRun | null>;
  listRuns(limit: number): Promise<WorkflowRun[]>;
  ensureWatchlist(targets: RepositoryTarget[]): Promise<void>;
}

type DailyItem = { repository: string; snapshot: RepositorySnapshot; analysis: RepositoryAnalysis };
type DailyFailure = { repository: string; error: string };

export class DefaultWorkflowService implements WorkflowService {
  public constructor(
    private readonly store: WorkflowStore,
    private readonly sources: WorkflowRepositorySource,
    private readonly collector: RepositorySourceCollector,
    private readonly analyzer: RepositoryAnalyzer,
  ) {}

  public async startDailyHealth(): Promise<number> {
    const runId = await this.store.createRun("daily_health", {}, dailySteps);
    queueMicrotask(() => void this.executeDaily(runId));
    return runId;
  }

  public async startQuickAssessment(repository: string): Promise<number> {
    const target = parseRepositoryReference(repository);
    const runId = await this.store.createRun("quick_assessment", { repository: `${target.owner}/${target.name}` }, quickSteps);
    queueMicrotask(() => void this.executeQuick(runId, target));
    return runId;
  }

  public async startWeeklyReport(): Promise<number> {
    const runId = await this.store.createRun("weekly_report", {}, weeklySteps);
    queueMicrotask(() => void this.executeWeekly(runId));
    return runId;
  }

  public getRun(runId: number): Promise<WorkflowRun | null> {
    return this.store.getRun(runId);
  }

  public listRuns(limit: number): Promise<WorkflowRun[]> {
    return this.store.listRuns(limit);
  }

  public ensureWatchlist(targets: RepositoryTarget[]): Promise<void> {
    return this.store.ensureWatchlist(targets);
  }

  private async executeDaily(runId: number): Promise<void> {
    await this.executeRun(runId, async () => {
      const targets = await this.step(runId, "load_watchlist", () => this.store.getWatchlist());
      if (targets.length === 0) throw new Error("关注列表为空");
      const analyzed = await this.step(runId, "analyze_repositories", async () => {
        const results: DailyItem[] = [];
        const failures: DailyFailure[] = [];
        for (const target of targets) {
          try {
            results.push(await withRetry(() => this.analyzeRepository(target), { attempts: 3, baseDelayMs: 500 }));
          } catch (error) {
            failures.push({ repository: formatTarget(target), error: errorMessage(error) });
          }
        }
        if (results.length === 0) throw new Error(`全部仓库分析失败：${failures.map((item) => item.error).join("；")}`);
        return { results, failures };
      });
      const ranking = await this.step(runId, "rank", async () => [...analyzed.results]
        .sort((left, right) => right.analysis.health_score - left.analysis.health_score)
        .map((item, index) => ({ rank: index + 1, repository: item.repository, ...item.analysis })));
      const report = await this.step(runId, "generate_report", async () => buildDailyReport(ranking, analyzed.failures));
      return { generated_at: new Date().toISOString(), ranking, failures: analyzed.failures, report };
    });
  }

  private async executeQuick(runId: number, target: RepositoryTarget): Promise<void> {
    await this.executeRun(runId, async () => {
      const collected = await this.step(runId, "collect", async () => ({
        snapshot: await withRetry(() => this.sources.getSnapshot(target), { attempts: 3, baseDelayMs: 500 }),
        documents: await withRetry(() => this.collector.collect(target), { attempts: 3, baseDelayMs: 500 }),
      }), (result) => ({
        snapshot: result.snapshot,
        sources: result.documents.map((document) => ({ type: document.sourceType, title: document.title, url: document.url })),
      }));
      const codeQuality = await this.step(runId, "code_quality", async () => scoreCodeQuality(collected.snapshot, collected.documents));
      const community = await this.step(runId, "community", async () => scoreCommunity(collected.snapshot));
      const competitors = await this.step(runId, "competitors", () => withRetry(
        () => this.sources.findCompetitors(target, collected.snapshot), { attempts: 3, baseDelayMs: 500 },
      ));
      const health = await this.step(runId, "risk", () => withRetry(
        () => this.analyzer.analyze(this.toAnalysisInput(collected.snapshot, null, collected.documents)),
        { attempts: 3, baseDelayMs: 500 },
      ));
      await this.store.saveSnapshot(target, collected.snapshot, health);
      const report = await this.step(runId, "final_report", async () => QuickAssessmentReportSchema.parse({
        repository: formatTarget(target),
        generated_at: new Date().toISOString(),
        code_quality: codeQuality,
        community,
        competitors,
        health,
        executive_summary: buildExecutiveSummary(collected.snapshot, health, codeQuality.score, community.score, competitors),
      }));
      return report;
    });
  }

  private async executeWeekly(runId: number): Promise<void> {
    await this.executeRun(runId, async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
      const history = await this.step(runId, "collect_history", async () => ({
        daily: await this.store.getRecentCompletedRuns("daily_health", since),
        quick: await this.store.getRecentCompletedRuns("quick_assessment", since),
      }));
      const summary = await this.step(runId, "aggregate", async () => summarizeWeek(history.daily, history.quick));
      const report = await this.step(runId, "generate_report", async () => buildWeeklyReport(summary));
      return { generated_at: new Date().toISOString(), summary, report };
    });
  }

  private async analyzeRepository(target: RepositoryTarget): Promise<DailyItem> {
    const previous = await this.store.getLatestSnapshot(target);
    const [snapshot, documents] = await Promise.all([this.sources.getSnapshot(target), this.collector.collect(target)]);
    const analysis = await this.analyzer.analyze(this.toAnalysisInput(snapshot, previous, documents));
    await this.store.saveSnapshot(target, snapshot, analysis);
    return { repository: formatTarget(target), snapshot, analysis };
  }

  private toAnalysisInput(snapshot: RepositorySnapshot, previous: RepositorySnapshot | null, documents: SourceDocument[]): RepositoryAnalysisInput {
    const issueResolutionRate = snapshot.opened_issues_30d === 0 ? 1 : snapshot.closed_issues_30d / snapshot.opened_issues_30d;
    const readme = documents.find((document) => document.sourceType === "readme")?.content.slice(0, 12_000);
    return {
      repository: {
        owner: snapshot.owner,
        name: snapshot.name,
        url: snapshot.url,
        description: snapshot.description || undefined,
        primary_language: snapshot.primary_language === "Unknown" ? undefined : snapshot.primary_language,
        stars: snapshot.stars,
        forks: snapshot.forks,
        open_issues: snapshot.open_issues,
        archived: snapshot.archived,
      },
      metrics: {
        stars_growth_rate: previous ? (snapshot.stars - previous.stars) / Math.max(previous.stars, 1) : 0,
        issue_resolution_rate: Math.min(1, issueResolutionRate),
        active_contributors_90d: snapshot.active_contributors_30d,
        contributor_diversity: Math.min(100, snapshot.active_contributors_30d * 10),
      },
      evidence: {
        ...(readme ? { readme_excerpt: readme } : {}),
        recent_signals: [
          `${snapshot.recent_commits_30d} commits in the last 30 days`,
          `${snapshot.closed_issues_30d}/${snapshot.opened_issues_30d} newly opened issues are closed`,
          previous ? `Previous stars: ${previous.stars}` : "First observation; historical star growth is unavailable",
        ],
      },
    };
  }

  private async executeRun<T>(runId: number, operation: () => Promise<T>): Promise<void> {
    await this.store.startRun(runId);
    try {
      await this.store.completeRun(runId, await operation());
    } catch (error) {
      await this.store.failRun(runId, errorMessage(error));
    }
  }

  private async step<T>(runId: number, key: string, operation: () => Promise<T>, summarize?: (result: T) => unknown): Promise<T> {
    try {
      const result = await withRetry(operation, {
        attempts: 3,
        baseDelayMs: 300,
        onAttempt: (attempt) => this.store.startStep(runId, key, attempt),
      });
      await this.store.completeStep(runId, key, summarize ? summarize(result) : result);
      return result;
    } catch (error) {
      await this.store.failStep(runId, key, errorMessage(error), 3);
      throw error;
    }
  }
}

function scoreCodeQuality(snapshot: RepositorySnapshot, documents: SourceDocument[]) {
  const readmeLength = documents.find((document) => document.sourceType === "readme")?.content.length ?? 0;
  const score = clamp(Math.round(35 + Math.min(25, readmeLength / 400) + Math.min(30, snapshot.recent_commits_30d * 2) + (snapshot.archived ? -40 : 10)));
  return { score, summary: `README ${readmeLength > 2_000 ? "较完整" : "信息有限"}，近 30 天 ${snapshot.recent_commits_30d} 次提交${snapshot.archived ? "，仓库已归档" : ""}。` };
}

function scoreCommunity(snapshot: RepositorySnapshot) {
  const score = clamp(Math.round(Math.min(35, Math.log10(snapshot.stars + 1) * 10) + Math.min(25, snapshot.active_contributors_30d * 5) + Math.min(20, snapshot.forks / 5) + Math.min(20, snapshot.closed_issues_30d * 2)));
  return { score, summary: `${snapshot.stars} stars、${snapshot.forks} forks，近 30 天有 ${snapshot.active_contributors_30d} 位活跃贡献者。` };
}

function buildExecutiveSummary(snapshot: RepositorySnapshot, health: RepositoryAnalysis, codeScore: number, communityScore: number, competitors: CompetitorRepository[]) {
  return `${snapshot.owner}/${snapshot.name} 的健康度为 ${health.health_score}/100，代码质量 ${codeScore}/100，社区活跃度 ${communityScore}/100。` +
    `当前建议为 ${health.recommendation}，识别到 ${health.risk_factors.length} 项风险，并找到 ${competitors.length} 个可比较项目。`;
}

function buildDailyReport(ranking: Array<{ rank: number; repository: string; health_score: number; recommendation: string }>, failures: DailyFailure[]) {
  const lines = ranking.map((item) => `${item.rank}. ${item.repository} — ${item.health_score}/100（${item.recommendation}）`);
  if (failures.length > 0) lines.push("", "失败项目：", ...failures.map((item) => `- ${item.repository}: ${item.error}`));
  return `# DevScope 每日项目健康报告\n\n生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}\n\n${lines.join("\n")}`;
}

function summarizeWeek(daily: WorkflowRun[], quick: WorkflowRun[]) {
  const latestDaily = daily[0]?.output as { ranking?: Array<{ repository: string; health_score: number; recommendation: string }> } | null;
  return {
    daily_reports: daily.length,
    quick_assessments: quick.length,
    latest_ranking: latestDaily?.ranking ?? [],
    period_days: 7,
  };
}

function buildWeeklyReport(summary: ReturnType<typeof summarizeWeek>) {
  const ranking = summary.latest_ranking.length > 0
    ? summary.latest_ranking.map((item, index) => `${index + 1}. ${item.repository} — ${item.health_score}/100（${item.recommendation}）`).join("\n")
    : "本周尚无每日健康报告数据。";
  return `# DevScope 每周项目汇总\n\n过去 7 天生成 ${summary.daily_reports} 份日报、${summary.quick_assessments} 份快速评估。\n\n## 最新排名\n\n${ranking}`;
}

function formatTarget(target: RepositoryTarget) {
  return `${target.owner}/${target.name}`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
