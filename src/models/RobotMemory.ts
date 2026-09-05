import mongoose from "mongoose";
import crypto from "crypto";

export type MemoryType = "PREFERENCE" | "GOAL" | "PROJECT_CONTEXT" | "PRODUCTIVITY_PATTERN" | "IMPORTANT_FACT";

const robotMemorySchema = new mongoose.Schema(
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
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["PREFERENCE", "GOAL", "PROJECT_CONTEXT", "PRODUCTIVITY_PATTERN", "IMPORTANT_FACT"],
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    _id: false,
  }
);

robotMemorySchema.index({ user_id: 1, created_at: -1 });

export interface IRobotMemory {
  user_id: string;
  content: string;
  type: MemoryType;
  created_at?: Date;
  updated_at?: Date;
}

export const RobotMemory = mongoose.model<IRobotMemory>("RobotMemory", robotMemorySchema);
