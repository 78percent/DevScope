import type { WorkflowService } from "@devscope/core";

export function startWorkflowScheduler(workflow: WorkflowService): () => void {
  let lastDaily = "";
  let lastWeekly = "";
  const check = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date()).map((part) => [part.type, part.value]));
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    if (parts.hour === "08" && parts.minute === "00" && lastDaily !== dateKey) {
      lastDaily = dateKey;
      void workflow.startDailyHealth();
    }
    if (parts.weekday === "Mon" && parts.hour === "08" && parts.minute === "30" && lastWeekly !== dateKey) {
      lastWeekly = dateKey;
      void workflow.startWeeklyReport();
    }
  };
  const timer = setInterval(check, 30_000);
  timer.unref();
  check();
  return () => clearInterval(timer);
}
