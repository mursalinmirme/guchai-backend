import { Response } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import { RobotNotification } from "../models/RobotNotification";
import { User } from "../models/User";

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Return un-dismissed notifications that haven't expired
    const notifications = await RobotNotification.find({
      user_id: req.user._id,
      dismissed_at: null,
      expires_at: { $gt: new Date() },
    })
      .sort({ created_at: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await RobotNotification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { read_at: new Date() },
      { new: true }
    );
    
    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await RobotNotification.updateMany(
      { user_id: req.user._id, read_at: null },
      { read_at: new Date() }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const dismissNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await RobotNotification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { dismissed_at: new Date() },
      { new: true }
    );
    
    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    
    res.json({ message: "Notification dismissed" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Preferences
// ─────────────────────────────────────────────────────────────

export const getPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select("preferences");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json((user as any).preferences || {});
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = req.body;
    
    // We only allow updating the preferences subdocument
    const updatePayload: any = {};
    for (const [key, value] of Object.entries(updates)) {
      updatePayload[`preferences.${key}`] = value;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).select("preferences");
    
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    res.json((user as any).preferences || {});
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
