import mongoose from "mongoose";
import crypto from "crypto";

const activitySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    user_id: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    task_id: {
      type: String,
      required: true,
    },
    task_title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    _id: false,
  }
);

activitySchema.index({ user_id: 1, created_at: -1 });

export type ActivityType =
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_reopened"
  | "task_deleted"
  | "priority_changed"
  | "due_date_changed"
  | "status_changed";

export interface IActivity {
  user_id: string;
  task_id: string;
  task_title: string;
  type: ActivityType | string;
  metadata?: Record<string, any>;
}

export const Activity = mongoose.model<IActivity>("Activity", activitySchema);
