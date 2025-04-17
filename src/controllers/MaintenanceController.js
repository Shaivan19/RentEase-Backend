const Maintenance = require('../models/MaintenanceModel');
const Property = require('../models/PropertyModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const Notification = require('../models/NotificationModel');
const { verifyToken } = require('../middleware/authMiddleware');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const dir = 'uploads/maintenance';
        try {
            await fs.mkdir(dir, { recursive: true });
            cb(null, dir);
        } catch (error) {
            cb(error, dir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed!'));
    }
}).array('images', 5); // Allow up to 5 images

const MaintenanceController = {
    // Create new maintenance request
    createRequest: async (req, res) => {
        try {
            upload(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({
                        success: false,
                        message: err.message
                    });
                }

                const { propertyId, title, description, priority } = req.body;

                // Get property details to get landlord info
                const property = await Property.findById(propertyId);
                if (!property) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                // Create maintenance request
                const maintenanceRequest = new Maintenance({
                    property: propertyId,
                    tenant: req.user.id,
                    landlord: property.landlord,
                    title,
                    description,
                    priority,
                    images: req.files ? req.files.map(file => file.path) : []
                });

                await maintenanceRequest.save();

                // Send email notifications
                // TODO: Implement email notification system

                res.status(201).json({
                    success: true,
                    message: 'Maintenance request created successfully',
                    data: maintenanceRequest
                });
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error creating maintenance request',
                error: error.message
            });
        }
    },

    // Get all maintenance requests for a property
    getPropertyRequests: async (req, res) => {
        try {
            const { propertyId } = req.params;
            const requests = await Maintenance.find({ property: propertyId })
                .populate('tenant', 'username email')
                .populate('landlord', 'username email')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                data: requests
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching maintenance requests',
                error: error.message
            });
        }
    },

    // Get all maintenance requests for a tenant
    getTenantRequests: async (req, res) => {
        try {
            const requests = await Maintenance.find({ tenant: req.user.id })
                .populate('property', 'name address')
                .populate('landlord', 'username email')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                data: requests
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching maintenance requests',
                error: error.message
            });
        }
    },

    // Get all maintenance requests for a landlord
    getLandlordRequests: async (req, res) => {
        try {
            const requests = await Maintenance.find({ landlord: req.user.id })
                .populate('property', 'name address')
                .populate('tenant', 'username email')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                data: requests
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching maintenance requests',
                error: error.message
            });
        }
    },

    // Update maintenance request status
    updateStatus: async (req, res) => {
        try {
            const { requestId } = req.params;
            const { status, comment, estimatedCost, scheduledDate } = req.body;

            const request = await Maintenance.findById(requestId);
            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            // Update request
            request.status = status;
            if (estimatedCost) request.estimatedCost = estimatedCost;
            if (scheduledDate) request.scheduledDate = scheduledDate;
            if (status === 'COMPLETED') request.completionDate = new Date();

            // Add comment if provided
            if (comment) {
                request.comments.push({
                    user: req.user.id,
                    userType: req.user.userType,
                    text: comment
                });
            }

            await request.save();

            // Send email notification about status update
            // TODO: Implement email notification system

            res.json({
                success: true,
                message: 'Maintenance request updated successfully',
                data: request
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error updating maintenance request',
                error: error.message
            });
        }
    },

    // Add comment to maintenance request
    addComment: async (req, res) => {
        try {
            const { requestId } = req.params;
            const { text } = req.body;

            const request = await Maintenance.findById(requestId);
            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            request.comments.push({
                user: req.user.id,
                userType: req.user.userType,
                text
            });

            await request.save();

            res.json({
                success: true,
                message: 'Comment added successfully',
                data: request
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error adding comment',
                error: error.message
            });
        }
    },

    // Get maintenance request details
    getRequestDetails: async (req, res) => {
        try {
            const { requestId } = req.params;
            const request = await Maintenance.findById(requestId)
                .populate('property', 'name address')
                .populate('tenant', 'username email')
                .populate('landlord', 'username email');

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            res.json({
                success: true,
                data: request
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error fetching maintenance request details',
                error: error.message
            });
        }
    },

    // Upload maintenance request images
    uploadMaintenanceImages: async (req, res) => {
        try {
            const { maintenanceId } = req.params;
            const maintenance = await Maintenance.findById(maintenanceId);
            
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }

            const images = req.files.map(file => ({
                url: file.path,
                description: file.originalname
            }));

            maintenance.images = [...maintenance.images, ...images];
            await maintenance.save();

            // Create notification for landlord
            const notification = new Notification({
                userId: maintenance.landlordId,
                userType: 'Landlord',
                type: 'maintenance',
                title: 'Maintenance Images Uploaded',
                message: 'New images have been uploaded for a maintenance request',
                relatedId: maintenance._id
            });
            await notification.save();

            res.json(maintenance);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get maintenance request images
    getMaintenanceImages: async (req, res) => {
        try {
            const maintenance = await Maintenance.findById(req.params.requestId);
            
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            
            res.json(maintenance.images);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Set maintenance priority
    setMaintenancePriority: async (req, res) => {
        try {
            const { priority } = req.body;
            const maintenance = await Maintenance.findById(req.params.requestId);
            
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }

            maintenance.priority = priority;
            await maintenance.save();

            // Create notification for tenant
            const notification = new Notification({
                userId: maintenance.tenantId,
                userType: 'Tenant',
                type: 'maintenance',
                title: 'Maintenance Priority Updated',
                message: `The priority of your maintenance request has been set to ${priority}`,
                relatedId: maintenance._id
            });
            await notification.save();

            res.json(maintenance);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get maintenance status
    getMaintenanceStatus: async (req, res) => {
        try {
            const maintenance = await Maintenance.findById(req.params.requestId);
            
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            
            res.json({ status: maintenance.status });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Assign maintenance to service provider
    assignMaintenance: async (req, res) => {
        try {
            const { serviceProviderId } = req.body;
            const maintenance = await Maintenance.findById(req.params.requestId);
            
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }

            maintenance.assignedTo = serviceProviderId;
            maintenance.status = 'assigned';
            await maintenance.save();

            // Create notifications
            const notifications = [
                new Notification({
                    userId: maintenance.tenantId,
                    userType: 'Tenant',
                    type: 'maintenance',
                    title: 'Maintenance Assigned',
                    message: 'A service provider has been assigned to your maintenance request',
                    relatedId: maintenance._id
                }),
                new Notification({
                    userId: serviceProviderId,
                    userType: 'ServiceProvider',
                    type: 'maintenance',
                    title: 'New Maintenance Assignment',
                    message: 'You have been assigned to a new maintenance request',
                    relatedId: maintenance._id
                })
            ];

            await Notification.insertMany(notifications);

            res.json(maintenance);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

module.exports = MaintenanceController; 