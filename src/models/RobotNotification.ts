import mongoose from "mongoose";
import crypto from "crypto";

export type NotificationType =
  | "DEADLINE_APPROACHING"
  | "TASK_OVERDUE"
  | "HIGH_PRIORITY_TASK"
  | "STALE_TASK"
  | "DAILY_BRIEFING"
  | "DAILY_REVIEW"
  | "WEEKLY_REVIEW"
  | "PRODUCTIVITY_INSIGHT";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

const robotNotificationSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: [
        "DEADLINE_APPROACHING",
        "TASK_OVERDUE",
        "HIGH_PRIORITY_TASK",
        "STALE_TASK",
        "DAILY_BRIEFING",
        "DAILY_REVIEW",
        "WEEKLY_REVIEW",
        "PRODUCTIVITY_INSIGHT",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH"],
      default: "NORMAL",
    },
    // Arbitrary metadata (task id, task title, etc.)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Tracking fields
    read_at: { type: Date, default: null },
    dismissed_at: { type: Date, default: null },
    // When the notification is no longer relevant
    expires_at: { type: Date, required: true, index: true },
    // Idempotency key — unique per user+event so we never duplicate
    // e.g. "deadline:task-uuid:6h:2024-01-15" 
    dedup_key: { type: String, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    _id: false,
  }
);

// Compound unique index for deduplication: one event per user
robotNotificationSchema.index({ user_id: 1, dedup_key: 1 }, { unique: true });
// Fast queries for active notifications
robotNotificationSchema.index({ user_id: 1, dismissed_at: 1, created_at: -1 });

export interface IRobotNotification {
  _id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  metadata: Record<string, any>;
  read_at: Date | null;
  dismissed_at: Date | null;
  expires_at: Date;
  dedup_key: string;
  created_at: Date;
}

export const RobotNotification = mongoose.model<IRobotNotification>(
  "RobotNotification",
  robotNotificationSchema
);
