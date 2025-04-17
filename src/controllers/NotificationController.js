const Notification = require("../models/NotificationModel");
const { verifyToken } = require("../middleware/authMiddleware");

const NotificationController = {
    // Get user notifications
    getUserNotifications: async (req, res) => {
        try {
            const userId = req.user._id;
            const userType = req.user.userType;
            
            const notifications = await Notification.find({
                userId,
                userType
            }).sort({ createdAt: -1 });
            
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Mark notification as read
    markNotificationAsRead: async (req, res) => {
        try {
            const notification = await Notification.findById(req.params.id);
            
            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();
            
            res.json(notification);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Set notification preferences
    setNotificationPreferences: async (req, res) => {
        try {
            const { preferences } = req.body;
            const userId = req.user._id;
            const userType = req.user.userType;
            
            // Update user's notification preferences
            // This would typically update a user's preferences in the User model
            // For now, we'll just return the preferences
            res.json({
                userId,
                userType,
                preferences
            });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get notification settings
    getNotificationSettings: async (req, res) => {
        try {
            const userId = req.user._id;
            const userType = req.user.userType;
            
            // Get user's notification settings
            // This would typically come from the User model
            // For now, we'll return default settings
            res.json({
                userId,
                userType,
                settings: {
                    email: true,
                    push: true,
                    sms: false,
                    types: {
                        lease: true,
                        payment: true,
                        maintenance: true,
                        application: true,
                        system: true
                    }
                }
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = NotificationController; 