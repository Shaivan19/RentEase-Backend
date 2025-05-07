const express = require("express");
const router = express.Router();
const LeaseController = require("../controllers/LeaseController");
const { verifyToken, isLandlord, isTenant } = require("../middleware/authMiddleware");

// Create new lease agreement
router.post("/leases/create", verifyToken, isLandlord, LeaseController.createLease);

// Get lease agreement details
router.get("/leases/:id", verifyToken, LeaseController.getLeaseById);

// Sign lease agreement
router.put("/leases/:id/sign", verifyToken, LeaseController.signLease);

// Get user's lease agreements
router.get("/leases/user/:userId", verifyToken, LeaseController.getUserLeases);

// Renew lease agreement
router.put("/leases/:id/renew", verifyToken, LeaseController.renewLease);

// Get lease renewal reminders
router.get("/leases/reminders", verifyToken, LeaseController.getLeaseReminders);

// Terminate lease agreement
router.post("/leases/:id/terminate", verifyToken, LeaseController.terminateLease);

router.get("/lease/:id", verifyToken, LeaseController.getLeaseWithPropertyDetails);

router.get("/bookings/tenant", verifyToken, isTenant, LeaseController.getAllBookingsForTenant);

module.exports = router; 