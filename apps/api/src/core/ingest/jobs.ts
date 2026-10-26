import { logger } from '../logger';

/**
 * Minimal in-process job runner for periodic work (feed polling, reminders).
 * Each job has its own interval and never overlaps itself. When the API runs
 * on several instances, move these to one worker (or a queue with locks).
 */
interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

const jobs: Job[] = [];
const timers: NodeJS.Timeout[] = [];

export function registerJob(job: Job): void {
  jobs.push(job);
}

export function startJobs(): void {
  for (const job of jobs) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await job.run();
      } catch (error) {
        logger.error({ err: error, job: job.name }, 'Job failed');
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void tick(), job.everyMs);
    timer.unref();
    timers.push(timer);
    void tick();
  }
  if (jobs.length > 0) logger.info({ jobs: jobs.map((j) => j.name) }, 'Background jobs started');
}

export function stopJobs(): void {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
}
