import express from "express";
import { protect } from "../middlewares/authMiddleware";
import { chat, getStatus, getMemories, deleteMemory, clearMemories } from "../controllers/robotController";
import { 
  getNotifications, 
  markNotificationRead, 
  markAllRead, 
  dismissNotification, 
  getPreferences, 
  updatePreferences 
} from "../controllers/notificationController";

const router = express.Router();

router.post("/chat", protect, chat);
router.get("/status", protect, getStatus);

// Memory routes
router.get("/memories", protect, getMemories);
router.delete("/memories/:id", protect, deleteMemory);
router.delete("/memories", protect, clearMemories);

// Notification routes
router.get("/notifications", protect, getNotifications);
router.post("/notifications/read-all", protect, markAllRead);
router.post("/notifications/:id/read", protect, markNotificationRead);
router.delete("/notifications/:id", protect, dismissNotification);

// Preference routes
router.get("/preferences", protect, getPreferences);
router.put("/preferences", protect, updatePreferences);

export default router;
