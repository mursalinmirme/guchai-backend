import { Response } from "express";
import { Task } from "../models/Task";
import { Activity } from "../models/Activity";
import { AuthRequest } from "../middlewares/authMiddleware";

// Helper to log activity without blocking the response
async function logActivity(
  userId: string,
  taskId: string,
  taskTitle: string,
  type: string,
  metadata: Record<string, any> = {}
) {
  try {
    await (Activity as any).create({ user_id: userId, task_id: taskId, task_title: taskTitle, type, metadata });
  } catch (err) {
    console.error("[Activity]", err);
  }
}

// @route   GET /api/tasks
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, from, to } = req.query;
    let query: any = { user_id: req.user._id };

    if (date) {
      query.task_date = date;
      const tasks = await Task.find(query).sort({ planned_start: 1 });
      res.json(tasks);
      return;
    } else if (from && to) {
      query.task_date = { $gte: from, $lte: to };
      const tasks = await Task.find(query).sort({ task_date: 1 });
      res.json(tasks);
      return;
    }

    const tasks = await Task.find(query).sort({ created_at: -1 });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/tasks
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.create({
      ...req.body,
      user_id: req.user._id,
      status: "pending",
    });
    res.status(201).json(task);
    logActivity(req.user._id, String(task._id), String(task.title), "task_created", {
      priority: String(task.priority),
      task_date: String(task.task_date),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @route   PATCH /api/tasks/:id
export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user_id: req.user._id });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(updatedTask);

    const changes = req.body;
    const taskStatus = String(task.status);
    const taskPriority = String(task.priority);
    const taskDate = String(task.task_date);

    let activityType = "task_updated";
    if (changes.status === "complete" && taskStatus !== "complete") {
      activityType = "task_completed";
    } else if (changes.status && changes.status !== "complete" && taskStatus === "complete") {
      activityType = "task_reopened";
    } else if (changes.status && changes.status !== taskStatus) {
      activityType = "status_changed";
    } else if (changes.priority && changes.priority !== taskPriority) {
      activityType = "priority_changed";
    } else if (changes.task_date && changes.task_date !== taskDate) {
      activityType = "due_date_changed";
    }

    logActivity(req.user._id, String(task._id), String(task.title), activityType, {
      changes,
      previous: { status: taskStatus, priority: taskPriority, task_date: taskDate },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @route   DELETE /api/tasks/:id
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user_id: req.user._id });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    await task.deleteOne();
    res.json({ message: "Task removed" });
    logActivity(req.user._id, String(task._id), String(task.title), "task_deleted", {
      priority: String(task.priority),
      task_date: String(task.task_date),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
