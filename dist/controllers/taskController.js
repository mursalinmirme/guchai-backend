"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.createTask = exports.getTasks = void 0;
const Task_1 = require("../models/Task");
// @route   GET /api/tasks
const getTasks = async (req, res) => {
    try {
        const { date, from, to } = req.query;
        let query = { user_id: req.user._id };
        if (date) {
            query.task_date = date;
            const tasks = await Task_1.Task.find(query).sort({ planned_start: 1 });
            // Map _id to id so frontend is happy, virtuals should handle it if toJSON is called
            res.json(tasks);
            return;
        }
        else if (from && to) {
            query.task_date = { $gte: from, $lte: to };
            const tasks = await Task_1.Task.find(query).sort({ task_date: 1 });
            res.json(tasks);
            return;
        }
        const tasks = await Task_1.Task.find(query).sort({ created_at: -1 });
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTasks = getTasks;
// @route   POST /api/tasks
const createTask = async (req, res) => {
    try {
        const task = await Task_1.Task.create({
            ...req.body,
            user_id: req.user._id,
            status: "pending",
        });
        res.status(201).json(task);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.createTask = createTask;
// @route   PATCH /api/tasks/:id
const updateTask = async (req, res) => {
    try {
        const task = await Task_1.Task.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!task) {
            res.status(404).json({ message: "Task not found" });
            return;
        }
        const updatedTask = await Task_1.Task.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
        res.json(updatedTask);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateTask = updateTask;
// @route   DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
    try {
        const task = await Task_1.Task.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!task) {
            res.status(404).json({ message: "Task not found" });
            return;
        }
        await task.deleteOne();
        res.json({ message: "Task removed" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteTask = deleteTask;
