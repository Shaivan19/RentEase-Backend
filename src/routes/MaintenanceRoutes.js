const express = require('express');
const router = express.Router();
const MaintenanceController = require('../controllers/MaintenanceController');
const { authenticateToken } = require('../middleware/auth');
const { verifyToken, isLandlord, isTenant } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/maintenance/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Create new maintenance request
router.post('/maintenance/request', authenticateToken, MaintenanceController.createRequest);

// Get maintenance requests for a property
router.get('/maintenance/property/:propertyId', authenticateToken, MaintenanceController.getPropertyRequests);

// Get maintenance requests for logged-in tenant
router.get('/maintenance/tenant', authenticateToken, MaintenanceController.getTenantRequests);

// Get maintenance requests for logged-in landlord
router.get('/maintenance/landlord', authenticateToken, MaintenanceController.getLandlordRequests);

// Update maintenance request status
router.put('/maintenance/:requestId/status', authenticateToken, MaintenanceController.updateStatus);

// Add comment to maintenance request
router.post('/maintenance/:requestId/comment', authenticateToken, MaintenanceController.addComment);

// Get maintenance request details
router.get('/maintenance/:requestId', authenticateToken, MaintenanceController.getRequestDetails);

// Upload maintenance request images
router.post("/maintenance/request/upload/:maintenanceId", 
    verifyToken, 
    isTenant, 
    upload.array('images', 5), 
    MaintenanceController.uploadMaintenanceImages
);

// Get maintenance request images
router.get("/maintenance/request/images/:requestId", 
    verifyToken, 
    MaintenanceController.getMaintenanceImages
);

// Set maintenance priority
router.put("/maintenance/request/priority/:requestId", 
    verifyToken, 
    isLandlord, 
    MaintenanceController.setMaintenancePriority
);

// Get maintenance status
router.get("/maintenance/request/status/:requestId", 
    verifyToken, 
    MaintenanceController.getMaintenanceStatus
);

// Assign maintenance to service provider
router.post("/maintenance/request/assign/:requestId", 
    verifyToken, 
    isLandlord, 
    MaintenanceController.assignMaintenance
);

module.exports = router; 