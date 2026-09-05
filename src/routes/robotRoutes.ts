import express from "express";
import { chat, getStatus } from "../controllers/robotController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(protect);

router.post("/chat", chat);
router.get("/status", getStatus);

export default router;
