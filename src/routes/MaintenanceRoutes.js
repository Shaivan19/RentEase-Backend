const express = require('express');
const router = express.Router();
const MaintenanceController = require('../controllers/MaintenanceController');
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");

// Debug: Log all controller methods
console.log('Available controller methods:', Object.keys(MaintenanceController));

// Debug: Check middleware
console.log('Middleware functions:', {
    verifyToken: typeof authMiddleware.verifyToken,
    isLandlord: typeof authMiddleware.isLandlord,
    isTenant: typeof authMiddleware.isTenant,
    adminAuth: typeof authMiddleware.adminAuth
});

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'temp/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Create new maintenance request with images
router.post('/maintenance/request', 
    authMiddleware.verifyToken, 
    authMiddleware.isTenant, 
    upload.array('images', 5), 
    MaintenanceController.createRequest
);

// Update maintenance request (Tenant only)
router.put('/maintenance/request/:requestId',
    authMiddleware.verifyToken,
    authMiddleware.isTenant,
    upload.array('images', 5),
    MaintenanceController.updateRequest
);

// Delete maintenance request (Tenant only)
router.delete('/maintenance/request/:requestId',
    authMiddleware.verifyToken,
    authMiddleware.isTenant,
    MaintenanceController.deleteRequest
);

// Get all maintenance requests (Admin only)
router.get('/maintenance/all', 
    authMiddleware.verifyToken, 
    authMiddleware.adminAuth, 
    MaintenanceController.getAllRequests
);

// Get maintenance requests for a property
router.get('/maintenance/property/:propertyId', 
    authMiddleware.verifyToken, 
    MaintenanceController.getPropertyRequests
);

// Get maintenance requests for logged-in tenant
router.get('/maintenance/tenant', 
    authMiddleware.verifyToken, 
    authMiddleware.isTenant, 
    MaintenanceController.getTenantRequests
);

// Get maintenance requests for logged-in landlord
router.get('/maintenance/landlord', 
    authMiddleware.verifyToken, 
    authMiddleware.isLandlord, 
    MaintenanceController.getLandlordRequests
);

// Update maintenance request status
router.put('/maintenance/:requestId/status', 
    authMiddleware.verifyToken, 
    authMiddleware.isLandlord, 
    MaintenanceController.updateStatus
);

// Add comment to maintenance request
router.post('/maintenance/:requestId/comment', 
    authMiddleware.verifyToken, 
    MaintenanceController.addComment
);

// Get maintenance request details
router.get('/maintenance/:requestId', 
    authMiddleware.verifyToken, 
    MaintenanceController.getRequestDetails
);

// Upload maintenance request images
router.post("/maintenance/request/upload/:maintenanceId", 
    authMiddleware.verifyToken, 
    authMiddleware.isTenant, 
    upload.array('images', 5), 
    MaintenanceController.uploadMaintenanceImages
);

// Get maintenance request images
router.get("/maintenance/request/images/:requestId", 
    authMiddleware.verifyToken, 
    MaintenanceController.getMaintenanceImages
);

// Set maintenance priority
router.put("/maintenance/request/priority/:requestId", 
    authMiddleware.verifyToken, 
    authMiddleware.isLandlord, 
    MaintenanceController.setMaintenancePriority
);

// Get maintenance status
router.get("/maintenance/request/status/:requestId", 
    authMiddleware.verifyToken, 
    MaintenanceController.getMaintenanceStatus
);

// Assign maintenance to service provider
router.post("/maintenance/request/assign/:requestId", 
    authMiddleware.verifyToken, 
    authMiddleware.isLandlord, 
    MaintenanceController.assignMaintenance
);

module.exports = router;