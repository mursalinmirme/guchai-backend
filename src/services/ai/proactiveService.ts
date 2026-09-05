/**
 * ProactiveService — V3 Proactive Intelligence Engine
 *
 * This service detects meaningful productivity events for users and creates
 * deduplicated notifications. It REUSES V2 productivityService logic where possible
 * and operates entirely on deterministic DB queries — no LLM calls per tick.
 */
import { Task } from "../../models/Task";
import { User } from "../../models/User";
import { RobotNotification, NotificationType, NotificationPriority } from "../../models/RobotNotification";

// ─────────────────────────────────────────────────────────────
// Config: Thresholds (centralized, not scattered)
// ─────────────────────────────────────────────────────────────

const THRESHOLDS = {
  DEADLINE_HOURS: [24, 6, 1] as const,        // notify at these intervals before deadline
  STALE_TASK_DAYS: 14,                          // task considered stale if unmodified > N days
  NOTIFICATION_EXPIRY_HOURS: 48,               // notifications expire after this many hours
  DAILY_BRIEFING_WINDOW_MINUTES: 30,           // how long after briefing time we still trigger
  REVIEW_WINDOW_MINUTES: 60,                    // review reminder window
};

// ─────────────────────────────────────────────────────────────
// Timezone helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns the current HH:mm time string in a given IANA timezone.
 * Falls back to UTC on invalid timezone.
 */
function getCurrentTimeInTZ(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  }
}

/**
 * Returns the current date string YYYY-MM-DD in a given timezone.
 */
function getCurrentDateInTZ(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()).split("/");
    return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Check if current time is within quiet hours.
 * Returns true if we should SUPPRESS non-critical notifications.
 */
function isInQuietHours(
  currentTime: string,  // "HH:mm"
  quietStart: string,   // "HH:mm" e.g. "22:00"
  quietEnd: string      // "HH:mm" e.g. "08:00"
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const now = toMinutes(currentTime);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);

  if (start > end) {
    // Overnight quiet hours (e.g. 22:00 to 08:00)
    return now >= start || now < end;
  } else {
    return now >= start && now < end;
  }
}

/**
 * Check if two HH:mm times are within N minutes of each other.
 */
function isWithinWindow(current: string, target: string, windowMinutes: number): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const diff = Math.abs(toMinutes(current) - toMinutes(target));
  return diff <= windowMinutes;
}

// ─────────────────────────────────────────────────────────────
// Notification creator (with deduplication)
// ─────────────────────────────────────────────────────────────

async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  metadata?: Record<string, any>;
  dedupKey: string;
  expiryHours?: number;
}): Promise<boolean> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (params.expiryHours ?? THRESHOLDS.NOTIFICATION_EXPIRY_HOURS));

  try {
    await RobotNotification.create({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority,
      metadata: params.metadata ?? {},
      read_at: null,
      dismissed_at: null,
      expires_at: expiresAt,
      dedup_key: params.dedupKey,
    });
    console.log(`[Proactive] Created ${params.type} for user ${params.userId} — key: ${params.dedupKey}`);
    return true;
  } catch (err: any) {
    // E11000 duplicate key — this event was already notified, silently skip
    if (err.code === 11000) {
      return false;
    }
    console.error("[Proactive] Failed to create notification:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Event Detectors
// ─────────────────────────────────────────────────────────────

async function evaluateDeadlineReminders(userId: string, prefs: any): Promise<void> {
  if (!prefs.deadlineReminders) return;

  const now = new Date();
  const todayStr = getCurrentDateInTZ(prefs.timezone || "UTC");

  // Get all incomplete tasks for today
  // @ts-ignore
  const todayTasks = await Task.find({
    user_id: userId,
    status: { $ne: "complete" },
    task_date: todayStr as any,
  });

  for (const task of todayTasks) {
    const plannedEnd = task.planned_end ? new Date(String(task.planned_end)) : null;
    if (!plannedEnd) continue;

    const diffMs = plannedEnd.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    for (const threshold of THRESHOLDS.DEADLINE_HOURS) {
      if (diffHours > 0 && diffHours <= threshold) {
        const dateStr = todayStr;
        const dedupKey = `deadline:${task._id}:${threshold}h:${dateStr}`;

        let timeLabel = `${threshold} hour${threshold !== 1 ? "s" : ""}`;
        let message = `"${task.title}" is due in about ${timeLabel}.`;

        await createNotification({
          userId,
          type: "DEADLINE_APPROACHING",
          title: "Deadline approaching",
          message,
          priority: threshold <= 1 ? "HIGH" : threshold <= 6 ? "NORMAL" : "LOW",
          metadata: { taskId: String(task._id), taskTitle: task.title, threshold },
          dedupKey,
          expiryHours: threshold + 2,
        });
        break; // Only notify the tightest threshold
      }
    }
  }
}

async function evaluateOverdueTasks(userId: string, prefs: any): Promise<void> {
  if (!prefs.overdueReminders) return;

  const todayStr = getCurrentDateInTZ(prefs.timezone || "UTC");

  // @ts-ignore
  const overdueTasks = await Task.find({
    user_id: userId,
    status: { $ne: "complete" },
    task_date: { $lt: todayStr as any },
  });

  if (overdueTasks.length === 0) return;

  // Notify once per day for the overdue situation (aggregate, not per task)
  const dedupKey = `overdue:${userId}:${todayStr}`;
  const count = overdueTasks.length;

  await createNotification({
    userId,
    type: "TASK_OVERDUE",
    title: `${count} overdue task${count !== 1 ? "s" : ""}`,
    message: count === 1
      ? `"${overdueTasks[0].title}" is overdue. Want me to help reprioritize?`
      : `You have ${count} overdue tasks. Want me to help reorganize your priorities?`,
    priority: count > 2 ? "HIGH" : "NORMAL",
    metadata: { count, taskIds: overdueTasks.map(t => String(t._id)) },
    dedupKey,
    expiryHours: 20, // Expires before the next day's check
  });
}

async function evaluateStaleTasks(userId: string, _prefs: any): Promise<void> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - THRESHOLDS.STALE_TASK_DAYS);

  const staleTasks = await Task.find({
    user_id: userId,
    status: "pending",
    updated_at: { $lt: staleThreshold },
  }).limit(3); // Cap at 3 stale task notifications

  for (const task of staleTasks) {
    const weekStr = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)).toString(); // weekly bucket
    const dedupKey = `stale:${task._id}:week${weekStr}`;

    await createNotification({
      userId,
      type: "STALE_TASK",
      title: "Stale task",
      message: `"${task.title}" has been in your backlog for over ${THRESHOLDS.STALE_TASK_DAYS} days. Want to finish, reschedule, or remove it?`,
      priority: "LOW",
      metadata: { taskId: String(task._id), taskTitle: task.title },
      dedupKey,
      expiryHours: 7 * 24, // 1 week
    });
  }
}

async function evaluateDailyBriefing(userId: string, prefs: any): Promise<void> {
  if (!prefs.dailyBriefing) return;

  const timezone = prefs.timezone || "UTC";
  const currentTime = getCurrentTimeInTZ(timezone);
  const todayStr = getCurrentDateInTZ(timezone);

  if (!isWithinWindow(currentTime, prefs.dailyBriefingTime || "08:00", THRESHOLDS.DAILY_BRIEFING_WINDOW_MINUTES)) {
    return;
  }

  const dedupKey = `briefing:${userId}:${todayStr}`;

  // Get quick summary from DB for the message
  // @ts-ignore
  const todayTasks = await Task.find({ user_id: userId, task_date: todayStr as any });
  const total = todayTasks.length;
  const completed = todayTasks.filter(t => t.status === "complete").length;

  await createNotification({
    userId,
    type: "DAILY_BRIEFING",
    title: "Good morning! Here's your day",
    message: total > 0
      ? `You have ${total} task${total !== 1 ? "s" : ""} planned today, ${completed} completed. Ask me to plan your day!`
      : "No tasks planned yet today. Ask me to create some!",
    priority: "NORMAL",
    metadata: { total, completed, date: todayStr },
    dedupKey,
    expiryHours: 12, // Morning briefing expires at midday-ish
  });
}

async function evaluateDailyReview(userId: string, prefs: any): Promise<void> {
  if (!prefs.dailyReviewReminder) return;

  const timezone = prefs.timezone || "UTC";
  const currentTime = getCurrentTimeInTZ(timezone);
  const todayStr = getCurrentDateInTZ(timezone);

  if (!isWithinWindow(currentTime, prefs.dailyReviewTime || "18:00", THRESHOLDS.REVIEW_WINDOW_MINUTES)) {
    return;
  }

  const dedupKey = `daily-review:${userId}:${todayStr}`;

  // @ts-ignore
  const todayTasks = await Task.find({ user_id: userId, task_date: todayStr as any });
  const completed = todayTasks.filter(t => t.status === "complete").length;
  const total = todayTasks.length;

  await createNotification({
    userId,
    type: "DAILY_REVIEW",
    title: "Time to review your day",
    message: completed > 0
      ? `You completed ${completed} of ${total} tasks today. Want to review your day?`
      : "How did today go? Ask me to review your day!",
    priority: "LOW",
    metadata: { completed, total, date: todayStr },
    dedupKey,
    expiryHours: 8, // Evening review expires overnight
  });
}

async function evaluateWeeklyReview(userId: string, prefs: any): Promise<void> {
  if (!prefs.weeklyReviewReminder) return;

  const timezone = prefs.timezone || "UTC";
  // Trigger on Sunday or Monday (day of week = 0 or 1)
  const dayOfWeek = new Date().toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
  });

  if (dayOfWeek !== "Sunday" && dayOfWeek !== "Monday") return;

  // Use current week number as dedup bucket
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekKey = weekStart.toISOString().split("T")[0];
  const dedupKey = `weekly-review:${userId}:${weekKey}`;

  await createNotification({
    userId,
    type: "WEEKLY_REVIEW",
    title: "Weekly productivity review",
    message: "Your weekly productivity review is ready. Ask me: 'Review my week'.",
    priority: "LOW",
    metadata: { weekKey },
    dedupKey,
    expiryHours: 48, // Available for 2 days
  });
}

// ─────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────

export async function runProactiveCheckForUser(userId: string): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const prefs = (user as any).preferences || {};

    // If proactive is disabled, skip all checks
    if (prefs.proactiveEnabled === false) return;

    const timezone = prefs.timezone || "UTC";
    const currentTime = getCurrentTimeInTZ(timezone);

    // Check quiet hours — suppress all non-critical checks
    const inQuietHours = isInQuietHours(
      currentTime,
      prefs.quietHoursStart || "22:00",
      prefs.quietHoursEnd || "08:00"
    );

    if (!inQuietHours) {
      // Only run these during active hours
      await evaluateDeadlineReminders(userId, prefs);
      await evaluateOverdueTasks(userId, prefs);
      await evaluateStaleTasks(userId, prefs);
      await evaluateDailyBriefing(userId, prefs);
      await evaluateDailyReview(userId, prefs);
      await evaluateWeeklyReview(userId, prefs);
    }

    // Clean up expired + dismissed notifications
    await RobotNotification.deleteMany({
      user_id: userId,
      $or: [
        { expires_at: { $lt: new Date() } },
        { dismissed_at: { $ne: null } },
      ],
    });
  } catch (err: any) {
    console.error(`[Proactive] Error checking user ${userId}:`, err.message);
  }
}

export async function runProactiveCheckForAllUsers(): Promise<void> {
  console.log("[Scheduler] Running proactive check for all users...");
  try {
    // Only fetch users who have proactive enabled (default is true)
    const users = await User.find({
      $or: [
        { "preferences.proactiveEnabled": true },
        { "preferences.proactiveEnabled": { $exists: false } },
      ],
    }).select("_id preferences");

    const results = await Promise.allSettled(
      users.map(u => runProactiveCheckForUser(String(u._id)))
    );

    const errors = results.filter(r => r.status === "rejected").length;
    console.log(`[Scheduler] Proactive check complete: ${users.length} users, ${errors} errors`);
  } catch (err: any) {
    console.error("[Scheduler] Failed to run proactive checks:", err.message);
  }
}
