import mongoose from "mongoose";
import crypto from "crypto";

const userPreferencesSchema = new mongoose.Schema(
  {
    // Timezone string e.g. "Asia/Dhaka", "America/New_York", "UTC"
    timezone: { type: String, default: "UTC" },
    // Master toggle for all proactive Robot features
    proactiveEnabled: { type: Boolean, default: true },
    // Quiet hours: no non-critical notifications during this window (HH:mm strings)
    quietHoursStart: { type: String, default: "22:00" },
    quietHoursEnd: { type: String, default: "08:00" },
    // Individual notification toggles
    deadlineReminders: { type: Boolean, default: true },
    overdueReminders: { type: Boolean, default: true },
    highPriorityReminders: { type: Boolean, default: true },
    dailyBriefing: { type: Boolean, default: false },
    dailyBriefingTime: { type: String, default: "08:00" },
    dailyReviewReminder: { type: Boolean, default: true },
    dailyReviewTime: { type: String, default: "18:00" },
    weeklyReviewReminder: { type: Boolean, default: true },
    // Voice preferences stored client-side via localStorage, but also here for cross-device
    voiceEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomUUID(),
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

export const User = mongoose.model("User", userSchema);

