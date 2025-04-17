const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/NotificationController");
const { verifyToken } = require("../middleware/authMiddleware");

// Get user notifications
router.get("/notifications", verifyToken, NotificationController.getUserNotifications);

// Mark notification as read
router.put("/notifications/:id/read", verifyToken, NotificationController.markNotificationAsRead);

// Set notification preferences
router.post("/notifications/preferences", verifyToken, NotificationController.setNotificationPreferences);

// Get notification settings
router.get("/notifications/settings", verifyToken, NotificationController.getNotificationSettings);

module.exports = router; 