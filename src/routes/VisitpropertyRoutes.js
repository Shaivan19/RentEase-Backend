const express = require("express");
const router = express.Router();
const visitController = require("../controllers/VisitpropertyController");
const { verifyToken } = require("../middleware/authMiddleware");
const { isTenant } = require("../middleware/authMiddleware");

// Tenant routes
router.post("/visit-properties/schedule", visitController.scheduleVisit);
router.put("/visit-properties/reschedule/:id", visitController.rescheduleVisit);
router.delete("/visit-properties/cancel/:visitId", visitController.cancelVisit);
router.delete("/visit-properties/remove/:visitId", visitController.deleteVisitPermanently);

// Landlord routes
router.put("/visit-properties/confirm/:visitId", verifyToken, visitController.confirmVisit);
router.put("/visit-properties/reject/:visitId", verifyToken, visitController.rejectVisit);

// Common routes
router.get("/allvisit", visitController.getAllVisits);
router.get("/visit-properties/:id", visitController.getVisitById);
router.get("/visits/tenant/:id", visitController.getVisitsByTenantId);

module.exports = router;
