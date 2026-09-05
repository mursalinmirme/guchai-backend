import express from "express";
import { chat, getStatus, getMemories, deleteMemory, clearMemories } from "../controllers/robotController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(protect);

router.post("/chat", protect, chat);
router.get("/status", protect, getStatus);
router.get("/memory", protect, getMemories);
router.delete("/memory/:id", protect, deleteMemory);
router.delete("/memory", protect, clearMemories);

export default router;
