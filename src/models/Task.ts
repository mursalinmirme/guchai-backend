import mongoose from "mongoose";
import crypto from "crypto";

const taskSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    user_id: {
      type: String,
      required: true,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "complete"],
      default: "pending",
      required: true,
    },
    task_date: {
      type: String,
      required: true, // YYYY-MM-DD
    },
    planned_start: {
      type: String,
      required: true,
    },
    planned_end: {
      type: String,
      required: true,
    },
    actual_start: {
      type: String,
      default: null,
    },
    actual_end: {
      type: String,
      default: null,
    },
    accumulated_seconds: {
      type: Number,
      default: 0,
    },
    position: {
      type: Number,
      default: 0,
    },
    // We explicitly map Supabase created_at / updated_at to these if we want,
    // but mongoose adds createdAt / updatedAt automatically with timestamps: true.
    // For compatibility with the frontend which expects created_at and updated_at:
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Map _id to id for the frontend
taskSchema.virtual("id").get(function () {
  return this._id;
});

export interface ITask {
  _id: string;
  user_id: string;
  title: string;
  details: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "complete";
  task_date: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  accumulated_seconds: number;
  position: number;
  created_at: Date;
  updated_at: Date;
  id: string;
}

export const Task = mongoose.model<ITask>("Task", taskSchema);
