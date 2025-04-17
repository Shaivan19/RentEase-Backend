const express = require("express");
const router = express.Router();
const ReviewController = require("../controllers/ReviewController");
const { verifyToken, isLandlord, isTenant } = require("../middleware/authMiddleware");

// Add property review
router.post("/reviews/property", verifyToken, isTenant, ReviewController.addPropertyReview);

// Add landlord review
router.post("/reviews/landlord", verifyToken, isTenant, ReviewController.addLandlordReview);

// Add tenant review
router.post("/reviews/tenant", verifyToken, isLandlord, ReviewController.addTenantReview);

// Get property reviews
router.get("/reviews/property/:propertyId", ReviewController.getPropertyReviews);

// Get user reviews
router.get("/reviews/user/:userId", ReviewController.getUserReviews);

module.exports = router; 