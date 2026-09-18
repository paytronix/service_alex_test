import { certificationService } from "../services/certification.service";
import { webhookService } from "../services/webhook.service";

interface PeriodicJob {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
}

function intervalFromEnv(variable: string, fallbackSeconds: number): number {
  const seconds = Number(process.env[variable] ?? fallbackSeconds);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : fallbackSeconds) * 1000;
}

/**
 * Lightweight in-process cron: recomputes certification statuses (emitting
 * expiry notifications) and retries webhook deliveries that are due.
 * Disabled with `SCHEDULER_ENABLED=false`, e.g. when running multiple replicas
 * where only one should own the jobs.
 */
export function startScheduler(): () => void {
  if (process.env.SCHEDULER_ENABLED === "false") return () => undefined;

  const jobs: PeriodicJob[] = [
    {
      name: "certification-statuses",
      intervalMs: intervalFromEnv("CERTIFICATION_REFRESH_INTERVAL_SECONDS", 3600),
      run: () => certificationService.refreshStatuses(),
    },
    {
      name: "webhook-retries",
      intervalMs: intervalFromEnv("WEBHOOK_RETRY_INTERVAL_SECONDS", 60),
      run: () => webhookService.retryPending(),
    },
  ];

  const timers = jobs.map((job) => {
    const tick = () => {
      job.run().catch((error) => {
        console.error(`[scheduler] job "${job.name}" failed`, error);
      });
    };
    tick();
    const timer = setInterval(tick, job.intervalMs);
    timer.unref();
    return timer;
  });

  return () => timers.forEach((timer) => clearInterval(timer));
}
