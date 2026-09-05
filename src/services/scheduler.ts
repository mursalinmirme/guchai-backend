/**
 * Scheduler — lightweight in-process scheduler for V3 proactive events.
 *
 * This uses a simple setInterval approach. For V4 this can be upgraded
 * to a proper cron library or external queue system without changing
 * any of the proactiveService logic.
 */
import { runProactiveCheckForAllUsers } from "./ai/proactiveService";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STARTUP_DELAY_MS = 30 * 1000; // 30 seconds after boot

export function startScheduler(): void {
  console.log("[Scheduler] Starting V3 proactive scheduler (interval: 5 minutes)");

  // First run after a short startup delay to let MongoDB settle
  setTimeout(async () => {
    await runProactiveCheckForAllUsers();
  }, STARTUP_DELAY_MS);

  // Recurring check every 5 minutes
  setInterval(async () => {
    await runProactiveCheckForAllUsers();
  }, INTERVAL_MS);
}
