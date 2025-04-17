const express = require("express");
const router = express.Router();
const ApplicationController = require("../controllers/ApplicationController");
const { verifyToken, isLandlord, isTenant } = require("../middleware/authMiddleware");

// Submit rental application
router.post("/applications", verifyToken, isTenant, ApplicationController.submitApplication);

// Get application details
router.get("/applications/:id", verifyToken, ApplicationController.getApplicationById);

// Get user's applications
router.get("/applications/user/:userId", verifyToken, isTenant, ApplicationController.getUserApplications);

// Get applications for a property
router.get("/applications/property/:propertyId", verifyToken, isLandlord, ApplicationController.getPropertyApplications);

// Update application status
router.put("/applications/:id/status", verifyToken, isLandlord, ApplicationController.updateApplicationStatus);

module.exports = router; 