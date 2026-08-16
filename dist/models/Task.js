"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const taskSchema = new mongoose_1.default.Schema({
    _id: {
        type: String,
        default: () => crypto_1.default.randomUUID(),
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
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Map _id to id for the frontend
taskSchema.virtual("id").get(function () {
    return this._id;
});
exports.Task = mongoose_1.default.model("Task", taskSchema);
