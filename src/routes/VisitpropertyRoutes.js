const express = require("express");
const router = express.Router();
const visitController = require("../controllers/VisitpropertyController");
const { verifyToken } = require("../middleware/authMiddleware");
const { isTenant } = require("../middleware/authMiddleware");


router.post("/visit/schedule", visitController.scheduleVisit);
router.put("/visit/reschedule/:id", visitController.rescheduleVisit);
router.delete("/visit/cancel/:id", visitController.cancelVisit);
router.get("/allvisit", visitController.getAllVisits);
router.get("/visit/:id", visitController.getVisitById);
router.get("/visit/tenant/:tenantId",verifyToken,isTenant,visitController.getVisitsByTenantId);

module.exports = router;
