import { Task } from "../../models/Task";
import { Activity } from "../../models/Activity";
import { RobotMemory } from "../../models/RobotMemory";
import { getRecommendedTasks, getProductivityInsights, getReviewData } from "./productivityService";
import { ToolDefinition } from "./AIProvider";

// ─────────────────────────────────────────────────────────────
// Tool schemas (what the LLM sees)
// ─────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "getTasks",
      description:
        "Retrieve tasks for the authenticated user. Supports filtering by date, status, priority, and search query. Use this to answer 'show my tasks', 'what's due today', 'what's overdue', etc.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["today", "tomorrow", "upcoming", "overdue", "completed", "pending", "in_progress", "all"],
            description: "Preset date/status filter. 'upcoming' means the next 7 days.",
          },
          task_date: {
            type: "string",
            description: "Specific date in YYYY-MM-DD format to filter tasks.",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Filter by priority level.",
          },
          search: {
            type: "string",
            description: "Keyword search in task title or details.",
          },
          limit: {
            type: "number",
            description: "Maximum number of tasks to return. Default 20.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTask",
      description: "Get a single specific task by ID. Use when you have a task ID from context.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The task ID.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description:
        "Create a new task. Infer the task_date from natural language (e.g. 'tomorrow' → next day's YYYY-MM-DD). planned_start and planned_end must be full ISO datetime strings. If the user doesn't provide times, use sensible defaults (e.g. 09:00 to 10:00 UTC).",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The task title (required).",
          },
          details: {
            type: "string",
            description: "Optional task description/details.",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Task priority. Default to 'medium' if not specified.",
          },
          task_date: {
            type: "string",
            description: "Task date in YYYY-MM-DD format.",
          },
          planned_start: {
            type: "string",
            description: "Planned start as full ISO datetime string, e.g. 2024-01-15T09:00:00.000Z",
          },
          planned_end: {
            type: "string",
            description: "Planned end as full ISO datetime string, e.g. 2024-01-15T10:00:00.000Z",
          },
        },
        required: ["title", "priority", "task_date", "planned_start", "planned_end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTask",
      description:
        "Update an existing task. Only include the fields that need changing. To complete a task, use completeTask instead.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The task ID to update.",
          },
          title: { type: "string", description: "New title." },
          details: { type: "string", description: "New details/description." },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "New priority.",
          },
          task_date: {
            type: "string",
            description: "New task date YYYY-MM-DD.",
          },
          planned_start: {
            type: "string",
            description: "New planned start ISO datetime.",
          },
          planned_end: {
            type: "string",
            description: "New planned end ISO datetime.",
          },
          status: {
            type: "string",
            enum: ["pending", "in_progress", "complete"],
            description: "New status.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "completeTask",
      description:
        "Mark a task as complete. This sets the status to 'complete' and records the actual_end timestamp.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The task ID to complete.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteTask",
      description:
        "Delete a task permanently. IMPORTANT: Only call this after the user has explicitly confirmed deletion (they said 'yes', 'delete it', 'confirm', etc.).",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The task ID to delete.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTaskAnalytics",
      description:
        "Get productivity analytics and statistics for the user. Returns task counts, completion rate, and breakdowns by priority/status.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "this_week", "this_month", "last_7_days", "last_30_days"],
            description: "Time period for the analytics.",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getActivityHistory",
      description:
        "Get the history of task activities (created, completed, updated, deleted) for the user. Use for questions like 'what did I complete yesterday?', 'what did I do this week?'.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of activity records to return. Default 20.",
          },
          type: {
            type: "string",
            enum: [
              "task_created",
              "task_updated",
              "task_completed",
              "task_reopened",
              "task_deleted",
              "priority_changed",
              "due_date_changed",
              "status_changed",
            ],
            description: "Filter by activity type.",
          },
          from_date: {
            type: "string",
            description: "Start date YYYY-MM-DD for filtering activities.",
          },
          to_date: {
            type: "string",
            description: "End date YYYY-MM-DD for filtering activities.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "saveMemory",
      description: "Save a new personal memory or preference for the user. Call this when the user asks you to remember something (e.g. 'remember that I prefer mornings'). Do NOT save sensitive info like passwords.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content to remember." },
          type: {
            type: "string",
            enum: ["PREFERENCE", "GOAL", "PROJECT_CONTEXT", "PRODUCTIVITY_PATTERN", "IMPORTANT_FACT"],
            description: "The category of this memory.",
          },
        },
        required: ["content", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteMemory",
      description: "Delete a specific saved memory by ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The memory ID to delete." },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearMemories",
      description: "Clear all saved memories for the user.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "planMyDay",
      description: "Analyzes today's tasks and upcoming deadlines, and generates a structured daily plan recommending what to focus on.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getRecommendedTasks",
      description: "Get a scored and ranked list of the most highly recommended tasks to work on next.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of tasks to recommend. Default 5." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reviewProductivity",
      description: "Get a structured review of the user's productivity for a specific period (day, week, month). Use for 'review my day', 'how did I do this week'.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["day", "week", "month"],
            description: "The time period to review.",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProductivityInsights",
      description: "Get trend analysis (improving vs declining) and deeper insights into productivity patterns. Use for 'show me my productivity trend'.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

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

async function logAct(
  userId: string,
  taskId: string,
  taskTitle: string,
  type: string,
  metadata: Record<string, any> = {}
) {
  try {
    await (Activity as any).create({ user_id: userId, task_id: taskId, task_title: taskTitle, type, metadata });
  } catch (e) {
    console.error("[Activity log]", e);
  }
}

// ─────────────────────────────────────────────────────────────
// Tool execution handlers
// ─────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (toolName) {
      case "getTasks": {
        const { filter, task_date, priority, search, limit = 20 } = args;
        let query: any = { user_id: userId };

        if (task_date) {
          query.task_date = task_date;
        } else if (filter) {
          const today = getTodayStr();
          const tomorrow = getDateStr(1);
          const weekFromNow = getDateStr(7);

          switch (filter) {
            case "today":
              query.task_date = today;
              break;
            case "tomorrow":
              query.task_date = tomorrow;
              break;
            case "upcoming":
              query.task_date = { $gte: tomorrow, $lte: weekFromNow };
              break;
            case "overdue":
              query.task_date = { $lt: today };
              query.status = { $ne: "complete" };
              break;
            case "completed":
              query.status = "complete";
              break;
            case "pending":
              query.status = "pending";
              break;
            case "in_progress":
              query.status = "in_progress";
              break;
            default:
              break;
          }
        }

        if (priority) query.priority = priority;

        let tasks = await Task.find(query).sort({ task_date: 1, planned_start: 1 }).limit(Number(limit));

        if (search) {
          const lower = String(search).toLowerCase();
          tasks = tasks.filter(
            (t) =>
              String(t.title).toLowerCase().includes(lower) ||
              (t.details && String(t.details).toLowerCase().includes(lower))
          );
        }

        // Convert to plain objects for serialization
        return { success: true, data: tasks.map((t) => t.toJSON()) };
      }

      case "getTask": {
        const task = await Task.findOne({ _id: args.id, user_id: userId });
        if (!task) return { success: false, error: "Task not found." };
        return { success: true, data: task.toJSON() };
      }

      case "createTask": {
        const { title, details, priority, task_date, planned_start, planned_end } = args;

        if (!title || !priority || !task_date || !planned_start || !planned_end) {
          return { success: false, error: "Missing required task fields." };
        }

        const task = await (Task as any).create({
          title: String(title),
          details: details ? String(details) : null,
          priority: String(priority),
          task_date: String(task_date),
          planned_start: String(planned_start),
          planned_end: String(planned_end),
          user_id: userId,
          status: "pending",
        });

        await logAct(userId, String(task._id), String(task.title), "task_created", {
          priority: String(task.priority),
          task_date: String(task.task_date),
        });

        return { success: true, data: task.toJSON() };
      }

      case "updateTask": {
        const { id, ...updates } = args;
        const task = await Task.findOne({ _id: id, user_id: userId });
        if (!task) return { success: false, error: "Task not found." };

        const updatedTask = await Task.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true, runValidators: true }
        );

        const taskPriority = String(task.priority);
        const taskDate = String(task.task_date);
        const taskStatus = String(task.status);

        const activityType =
          updates.status === "complete"
            ? "task_completed"
            : updates.priority && String(updates.priority) !== taskPriority
              ? "priority_changed"
              : updates.task_date && String(updates.task_date) !== taskDate
                ? "due_date_changed"
                : updates.status && String(updates.status) !== taskStatus
                  ? "status_changed"
                  : "task_updated";

        await logAct(userId, String(task._id), String(task.title), activityType, updates);

        return { success: true, data: updatedTask?.toJSON() };
      }

      case "completeTask": {
        const task = await Task.findOne({ _id: args.id, user_id: userId });
        if (!task) return { success: false, error: "Task not found." };

        const patch: any = { status: "complete", actual_end: new Date().toISOString() };
        const taskStatus = String(task.status);
        const taskActualStart = task.actual_start ? String(task.actual_start) : null;

        if (taskStatus === "in_progress" && taskActualStart) {
          const delta = Math.floor((Date.now() - new Date(taskActualStart).getTime()) / 1000);
          patch.accumulated_seconds = (Number(task.accumulated_seconds) || 0) + Math.max(0, delta);
          patch.actual_start = null;
        }

        const updatedTask = await Task.findByIdAndUpdate(
          args.id,
          { $set: patch },
          { new: true }
        );

        await logAct(userId, String(task._id), String(task.title), "task_completed", {
          previous_status: taskStatus,
        });

        return { success: true, data: updatedTask?.toJSON() };
      }

      case "deleteTask": {
        const task = await Task.findOne({ _id: args.id, user_id: userId });
        if (!task) return { success: false, error: "Task not found." };

        const taskTitle = String(task.title);
        const taskPriority = String(task.priority);
        const taskDate = String(task.task_date);
        const taskId = String(task._id);

        await task.deleteOne();

        await logAct(userId, taskId, taskTitle, "task_deleted", {
          priority: taskPriority,
          task_date: taskDate,
        });

        return { success: true, data: { deleted: true, task_id: taskId } };
      }

      case "getTaskAnalytics": {
        const { period } = args;
        const today = getTodayStr();

        let dateFilter: any = {};
        switch (period) {
          case "today":
            dateFilter = { task_date: today };
            break;
          case "this_week": {
            const d = new Date();
            const day = d.getDay();
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - day);
            dateFilter = { task_date: { $gte: weekStart.toISOString().split("T")[0], $lte: today } };
            break;
          }
          case "this_month": {
            const monthStart = today.substring(0, 7) + "-01";
            dateFilter = { task_date: { $gte: monthStart, $lte: today } };
            break;
          }
          case "last_7_days":
            dateFilter = { task_date: { $gte: getDateStr(-7), $lte: today } };
            break;
          case "last_30_days":
            dateFilter = { task_date: { $gte: getDateStr(-30), $lte: today } };
            break;
        }

        const tasks = await Task.find({ user_id: userId, ...dateFilter });
        const total = tasks.length;

        const completed = tasks.filter((t) => String(t.status) === "complete").length;
        const pending = tasks.filter((t) => String(t.status) === "pending").length;
        const inProgress = tasks.filter((t) => String(t.status) === "in_progress").length;
        const overdue = tasks.filter(
          (t) => String(t.task_date) < today && String(t.status) !== "complete"
        ).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const byPriority = {
          urgent: tasks.filter((t) => String(t.priority) === "urgent").length,
          high: tasks.filter((t) => String(t.priority) === "high").length,
          medium: tasks.filter((t) => String(t.priority) === "medium").length,
          low: tasks.filter((t) => String(t.priority) === "low").length,
        };

        const totalWorkedSeconds = tasks.reduce((s, t) => s + (Number(t.accumulated_seconds) || 0), 0);

        return {
          success: true,
          data: {
            period,
            totalTasks: total,
            completed,
            pending,
            inProgress,
            overdue,
            completionRate,
            byPriority,
            totalWorkedSeconds,
            totalWorkedHours: Math.round((totalWorkedSeconds / 3600) * 10) / 10,
          },
        };
      }

      case "getActivityHistory": {
        const { limit = 20, type, from_date, to_date } = args;
        const query: any = { user_id: userId };

        if (type) query.type = type;
        if (from_date || to_date) {
          query.created_at = {};
          if (from_date) query.created_at.$gte = new Date(String(from_date));
          if (to_date) {
            const end = new Date(String(to_date));
            end.setDate(end.getDate() + 1);
            query.created_at.$lte = end;
          }
        }

        const activities = await Activity.find(query)
          .sort({ created_at: -1 })
          .limit(Number(limit));

        return { success: true, data: activities.map((a) => a.toJSON()) };
      }

      case "saveMemory": {
        const { content, type } = args;
        if (!content || !type) return { success: false, error: "content and type required." };
        const mem = await RobotMemory.create({ user_id: userId, content: String(content), type: String(type) as any }) as any;
        return { success: true, data: mem.toJSON() };
      }

      case "deleteMemory": {
        const mem = await RobotMemory.findOneAndDelete({ _id: args.id, user_id: userId });
        if (!mem) return { success: false, error: "Memory not found." };
        return { success: true, data: { deleted: true } };
      }

      case "clearMemories": {
        await RobotMemory.deleteMany({ user_id: userId });
        return { success: true, data: { cleared: true } };
      }

      case "planMyDay": {
        const today = getTodayStr();
        const todayTasks = await Task.find({ user_id: userId, task_date: today }).sort({ priority: -1 });
        const overdueTasks = await Task.find({ user_id: userId, status: { $ne: "complete" }, task_date: { $lt: today } });
        const recommended = await getRecommendedTasks(userId, 3);
        
        return {
          success: true,
          data: {
            today_total: todayTasks.length,
            today_pending: todayTasks.filter((t) => String(t.status) !== "complete").length,
            overdue_count: overdueTasks.length,
            recommended_tasks: recommended,
            today_tasks: todayTasks.slice(0, 10).map(t => t.toJSON()), // limit output
          },
        };
      }

      case "getRecommendedTasks": {
        const { limit = 5 } = args;
        const recommended = await getRecommendedTasks(userId, Number(limit));
        return { success: true, data: recommended };
      }

      case "reviewProductivity": {
        const { period } = args;
        const data = await getReviewData(userId, period);
        return { success: true, data };
      }

      case "getProductivityInsights": {
        const data = await getProductivityInsights(userId);
        return { success: true, data };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`[Tool:${toolName}]`, err);
    return { success: false, error: "Internal error executing tool." };
  }
}
