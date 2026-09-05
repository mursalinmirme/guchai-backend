import { Task } from "../../models/Task";
import { Activity } from "../../models/Activity";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────
// Scoring Mechanism
// ─────────────────────────────────────────────────────────────

/**
 * priority weight + deadline urgency + overdue penalty
 */
function scoreTask(task: any, todayStr: string): number {
  let score = 0;

  // Priority weight
  if (task.priority === "urgent") score += 40;
  else if (task.priority === "high") score += 30;
  else if (task.priority === "medium") score += 20;
  else if (task.priority === "low") score += 10;

  // Due date / overdue penalty
  const taskDate = String(task.task_date);
  if (taskDate < todayStr) {
    // Overdue
    const daysOverdue = Math.floor(
      (new Date(todayStr).getTime() - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    score += 15 + Math.min(daysOverdue * 2, 20); // Cap overdue penalty addition to +35 max
  } else if (taskDate === todayStr) {
    // Due today
    score += 25;
  } else {
    // Upcoming
    const daysUntil = Math.floor(
      (new Date(taskDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 3) score += 10;
  }

  // Bonus if in progress
  if (task.status === "in_progress") {
    score += 15;
  }

  return score;
}

// ─────────────────────────────────────────────────────────────
// Service Functions
// ─────────────────────────────────────────────────────────────

export async function getRecommendedTasks(userId: string, limit = 5) {
  const today = getTodayStr();

  const pendingTasks = await Task.find({
    user_id: userId,
    status: { $ne: "complete" },
  });

  const scored = pendingTasks.map((t) => ({
    ...t.toJSON(),
    score: scoreTask(t, today),
  }));

  // Sort descending by score, then ascending by planned_start if scores tie
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.planned_start || "").localeCompare(String(b.planned_start || ""));
  });

  return scored.slice(0, limit);
}

export async function getProductivityInsights(userId: string) {
  const today = getTodayStr();
  const weekStart = getDateStr(-7);
  const prevWeekStart = getDateStr(-14);

  // This week (last 7 days)
  // @ts-ignore
  const thisWeekTasks = await Task.find({
    user_id: userId,
    task_date: { $gt: weekStart as any, $lte: today as any },
  });

  // Previous week (days -14 to -7)
  // @ts-ignore
  const prevWeekTasks = await Task.find({
    user_id: userId,
    task_date: { $gt: prevWeekStart as any, $lte: weekStart as any },
  });

  const thisWeekCompleted = thisWeekTasks.filter((t) => t.status === "complete").length;
  const prevWeekCompleted = prevWeekTasks.filter((t) => t.status === "complete").length;

  // @ts-ignore
  const thisWeekOverdue = await Task.countDocuments({
    user_id: userId,
    status: { $ne: "complete" },
    task_date: { $lt: today as any, $gte: weekStart as any },
  });

  // @ts-ignore
  const prevWeekOverdue = await Task.countDocuments({
    user_id: userId,
    status: { $ne: "complete" },
    task_date: { $lt: weekStart as any, $gte: prevWeekStart as any },
  });

  let completionTrend = "stable";
  if (thisWeekCompleted > prevWeekCompleted) completionTrend = "improving";
  else if (thisWeekCompleted < prevWeekCompleted) completionTrend = "declining";

  let backlogTrend = "stable";
  if (thisWeekOverdue > prevWeekOverdue) backlogTrend = "growing";
  else if (thisWeekOverdue < prevWeekOverdue) backlogTrend = "shrinking";

  return {
    this_week_completed: thisWeekCompleted,
    previous_week_completed: prevWeekCompleted,
    completion_trend: completionTrend,
    this_week_overdue: thisWeekOverdue,
    previous_week_overdue: prevWeekOverdue,
    backlog_trend: backlogTrend,
    insight: `Your completion rate is ${completionTrend} and your backlog is ${backlogTrend}.`,
  };
}

export async function getReviewData(userId: string, period: "day" | "week" | "month") {
  const today = getTodayStr();
  let startDate = today;

  if (period === "week") {
    startDate = getDateStr(-7);
  } else if (period === "month") {
    startDate = getDateStr(-30);
  }

  // @ts-ignore
  const tasks = await Task.find({
    user_id: userId,
    task_date: { $gte: startDate as any, $lte: today as any },
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "complete");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const pending = tasks.filter((t) => t.status === "pending");

  // @ts-ignore
  const overdue = await Task.countDocuments({
    user_id: userId,
    status: { $ne: "complete" },
    task_date: { $lt: today as any },
  });

  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Find most productive day
  const completionsByDate: Record<string, number> = {};
  completed.forEach((t) => {
    const d = String(t.task_date);
    completionsByDate[d] = (completionsByDate[d] || 0) + 1;
  });

  let mostProductiveDay = null;
  let maxCompletions = 0;
  for (const [d, count] of Object.entries(completionsByDate)) {
    if (count > maxCompletions) {
      mostProductiveDay = d;
      maxCompletions = count;
    }
  }

  const priorityBreakdown = {
    urgent: completed.filter((t) => t.priority === "urgent").length,
    high: completed.filter((t) => t.priority === "high").length,
    medium: completed.filter((t) => t.priority === "medium").length,
    low: completed.filter((t) => t.priority === "low").length,
  };

  return {
    period,
    total_tasks: total,
    completed: completed.length,
    in_progress: inProgress.length,
    pending: pending.length,
    overdue,
    completion_rate: completionRate,
    most_productive_day: mostProductiveDay,
    max_completions_in_one_day: maxCompletions,
    completed_priority_breakdown: priorityBreakdown,
  };
}
