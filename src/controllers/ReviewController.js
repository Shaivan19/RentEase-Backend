const Review = require("../models/ReviewModel");
const Notification = require("../models/NotificationModel");
const { verifyToken } = require("../middleware/authMiddleware");

const ReviewController = {
    // Add property review
    addPropertyReview: async (req, res) => {
        try {
            const review = new Review({
                ...req.body,
                reviewType: 'property'
            });
            await review.save();

            // Create notification for landlord
            const notification = new Notification({
                userId: review.targetId, // property owner's ID
                userType: 'Landlord',
                type: 'review',
                title: 'New Property Review',
                message: 'A new review has been posted for your property',
                relatedId: review._id
            });
            await notification.save();

            res.status(201).json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Add landlord review
    addLandlordReview: async (req, res) => {
        try {
            const review = new Review({
                ...req.body,
                reviewType: 'landlord'
            });
            await review.save();

            // Create notification for landlord
            const notification = new Notification({
                userId: review.targetId,
                userType: 'Landlord',
                type: 'review',
                title: 'New Review',
                message: 'A new review has been posted about you',
                relatedId: review._id
            });
            await notification.save();

            res.status(201).json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Add tenant review
    addTenantReview: async (req, res) => {
        try {
            const review = new Review({
                ...req.body,
                reviewType: 'tenant'
            });
            await review.save();

            // Create notification for tenant
            const notification = new Notification({
                userId: review.targetId,
                userType: 'Tenant',
                type: 'review',
                title: 'New Review',
                message: 'A new review has been posted about you',
                relatedId: review._id
            });
            await notification.save();

            res.status(201).json(review);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get property reviews
    getPropertyReviews: async (req, res) => {
        try {
            const reviews = await Review.find({
                reviewType: 'property',
                targetId: req.params.propertyId,
                status: 'approved'
            }).populate('reviewerId', 'username avatar');
            
            res.json(reviews);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get user reviews
    getUserReviews: async (req, res) => {
        try {
            const reviews = await Review.find({
                targetId: req.params.userId,
                status: 'approved'
            }).populate('reviewerId', 'username avatar');
            
            res.json(reviews);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = ReviewController; 