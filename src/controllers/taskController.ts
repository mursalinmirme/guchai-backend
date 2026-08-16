import { Response } from "express";
import { Task } from "../models/Task";
import { AuthRequest } from "../middlewares/authMiddleware";

// @route   GET /api/tasks
export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, from, to } = req.query;
    let query: any = { user_id: req.user._id };

    if (date) {
      query.task_date = date;
      const tasks = await Task.find(query).sort({ planned_start: 1 });
      // Map _id to id so frontend is happy, virtuals should handle it if toJSON is called
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
