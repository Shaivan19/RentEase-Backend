const Maintenance = require('../models/MaintenanceModel');
const Property = require('../models/PropertyModel');
const multer = require('multer');
const path = require('path');
const { uploadFileToCloudinary } = require('../utils/CloudinaryUtil');
const { sendEmail } = require('../utils/MailUtil');
const Notification = require('../models/NotificationModel');
const { verifyToken } = require('../middleware/authMiddleware');

// Configure multer for temporary file storage before Cloudinary upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'temp/');
    },
    filename: function (req, file, cb) {
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
}).array('images', 5);

const MaintenanceController = {
    // Create new maintenance request
    createRequest: async (req, res) => {
        try {
            console.log('Received maintenance request:', req.body);
            console.log('Files:', req.files);
            console.log('User:', req.user);
            
            const { propertyId, title, description, priority } = req.body;
            
            if (!propertyId || !title || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: propertyId, title, and description are required'
                });
            }

            // Get property details to get landlord info
            const property = await Property.findById(propertyId);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found'
                });
            }

            // Upload images to Cloudinary
            let images = [];
            if (req.files && req.files.length > 0) {
                try {
                    const uploadPromises = req.files.map(async (file) => {
                        const result = await uploadFileToCloudinary(file);
                        return {
                            url: result.secure_url,
                            description: file.originalname
                        };
                    });
                    images = await Promise.all(uploadPromises);
                } catch (uploadError) {
                    console.error('Error uploading images:', uploadError);
                    return res.status(500).json({
                        success: false,
                        message: 'Error uploading images',
                        error: uploadError.message
                    });
                }
            }

            // Create maintenance request
            const maintenanceRequest = new Maintenance({
                propertyId,
                tenantId: req.user._id,
                landlordId: property.owner,
                title,
                description,
                priority: priority || 'medium',
                images,
                status: 'pending'
            });

            await maintenanceRequest.save();

            // Create notification for landlord
            const notification = new Notification({
                userId: property.owner,
                userType: 'Landlord',
                type: 'maintenance',
                title: 'New Maintenance Request',
                message: `New maintenance request from tenant: ${title}`,
                relatedId: maintenanceRequest._id
            });
            await notification.save();

            // Send email to tenant
            const emailSubject = 'Maintenance Request Filed Successfully';
            const emailText = `
                Maintenance Request Confirmation
                
                Your maintenance request has been filed successfully.
                
                Title: ${title}
                Description: ${description}
                Priority: ${priority || 'medium'}
                
                We will notify you once the landlord reviews your request.
            `;

            try {
                await sendEmail(req.user.email, emailSubject, emailText);
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                // Don't fail the request if email fails
            }

            res.status(201).json({
                success: true,
                message: 'Maintenance request created successfully',
                data: maintenanceRequest
            });
        } catch (error) {
            console.error('Error in createRequest:', error);
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
            const requests = await Maintenance.find({ propertyId })
                .populate('propertyId', 'name title address')
                .populate('tenantId', 'username email')
                .populate('landlordId', 'username email')
                .sort({ createdAt: -1 });

            console.log('Fetched maintenance requests:', requests); // Debug log

            res.json({
                success: true,
                data: requests
            });
        } catch (error) {
            console.error('Error in getPropertyRequests:', error);
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
            const requests = await Maintenance.find({ tenantId: req.user.id })
                .populate('propertyId', 'name address')
                .populate('landlordId', 'username email')
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
            console.log('Landlord user:', req.user); // Debug log
            const landlordId = req.user._id || req.user.id;
            console.log('Using landlordId:', landlordId); // Debug log

            const requests = await Maintenance.find({
                $or: [
                    { landlordId: landlordId },
                    { landlordId: landlordId.toString() }
                ]
            })
            .populate('propertyId', 'name title address')
            .populate('tenantId', 'username email')
            .sort({ createdAt: -1 });

            console.log('Found maintenance requests:', JSON.stringify(requests, null, 2)); // Debug log with full details

            res.json({
                success: true,
                data: requests
            });
        } catch (error) {
            console.error('Error in getLandlordRequests:', error);
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
            const { status, comment } = req.body;

            const maintenance = await Maintenance.findById(requestId);
            if (!maintenance) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            maintenance.status = status;
            if (comment) {
                maintenance.comments.push({
                    userId: req.user.id,
                    userType: 'Landlord',
                    comment,
                    timestamp: new Date()
                });
            }

            await maintenance.save();

            // Create notification for tenant
            const notification = new Notification({
                userId: maintenance.tenantId,
                userType: 'Tenant',
                type: 'maintenance',
                title: 'Maintenance Status Updated',
                message: `Your maintenance request status has been updated to: ${status}`,
                relatedId: maintenance._id
            });
            await notification.save();

            res.json({
                success: true,
                message: 'Maintenance request status updated successfully',
                data: maintenance
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error updating maintenance request status',
                error: error.message
            });
        }
    },

    // Add comment to maintenance request
    addComment: async (req, res) => {
        try {
            const { requestId } = req.params;
            const { comment } = req.body;

            const maintenance = await Maintenance.findById(requestId);
            if (!maintenance) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            maintenance.comments.push({
                userId: req.user.id,
                userType: req.user.userType,
                comment,
                timestamp: new Date()
            });

            await maintenance.save();

            res.json({
                success: true,
                message: 'Comment added successfully',
                data: maintenance
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
            const maintenance = await Maintenance.findById(requestId)
                .populate('propertyId', 'name address')
                .populate('tenantId', 'username email')
                .populate('landlordId', 'username email');

            if (!maintenance) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            res.json({
                success: true,
                data: maintenance
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
    },

    // Get all maintenance requests (Admin only)
    getAllRequests: async (req, res) => {
        try {
            const requests = await Maintenance.find()
                .populate('propertyId', 'name address')
                .populate('tenantId', 'username email')
                .populate('landlordId', 'username email')
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

    // Update maintenance request (Tenant only)
    updateRequest: async (req, res) => {
        try {
            const { requestId } = req.params;
            const { title, description, priority } = req.body;
            
            // Find the maintenance request
            const maintenance = await Maintenance.findById(requestId);
            
            if (!maintenance) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            // Check if the request belongs to the tenant
            if (maintenance.tenantId.toString() !== req.user._id?.toString() && 
                maintenance.tenantId.toString() !== req.user.id?.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to update this request'
                });
            }

            // Check if the request can be updated (only pending requests can be updated)
            if (maintenance.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Only pending requests can be updated'
                });
            }

            // Upload new images if provided
            let newImages = [];
            if (req.files && req.files.length > 0) {
                const uploadPromises = req.files.map(async (file) => {
                    const result = await uploadFileToCloudinary(file);
                    return {
                        url: result.secure_url,
                        description: file.originalname
                    };
                });
                newImages = await Promise.all(uploadPromises);
            }

            // Update the maintenance request
            const updatedFields = {};
            if (title) updatedFields.title = title;
            if (description) updatedFields.description = description;
            if (priority) updatedFields.priority = priority;
            if (newImages.length > 0) {
                updatedFields.images = [...maintenance.images, ...newImages];
            }

            const updatedMaintenance = await Maintenance.findByIdAndUpdate(
                requestId,
                { $set: updatedFields },
                { new: true }
            ).populate('propertyId', 'name address')
             .populate('tenantId', 'username email')
             .populate('landlordId', 'username email');

            // Create notification for landlord about the update
            const notification = new Notification({
                userId: maintenance.landlordId,
                userType: 'Landlord',
                type: 'maintenance',
                title: 'Maintenance Request Updated',
                message: `A maintenance request has been updated by the tenant: ${title || maintenance.title}`,
                relatedId: maintenance._id
            });
            await notification.save();

            // Send email to tenant about the update
            const emailSubject = 'Maintenance Request Updated';
            const emailText = `
                Maintenance Request Update Confirmation
                
                Your maintenance request has been updated successfully.
                
                Title: ${title || maintenance.title}
                Description: ${description || maintenance.description}
                Priority: ${priority || maintenance.priority}
                
                We will notify you once the landlord reviews your updated request.
            `;

            await sendEmail(req.user.email, emailSubject, emailText);

            res.json({
                success: true,
                message: 'Maintenance request updated successfully',
                data: updatedMaintenance
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error updating maintenance request',
                error: error.message
            });
        }
    },

    // Delete maintenance request (Tenant only)
    deleteRequest: async (req, res) => {
        try {
            const { requestId } = req.params;
            
            // Find the maintenance request
            const maintenance = await Maintenance.findById(requestId);
            
            if (!maintenance) {
                return res.status(404).json({
                    success: false,
                    message: 'Maintenance request not found'
                });
            }

            // Check if the request belongs to the tenant
            if (maintenance.tenantId.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to delete this request'
                });
            }

            // Check if the request can be deleted (only pending requests can be deleted)
            if (maintenance.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Only pending requests can be deleted'
                });
            }

            // Delete the maintenance request
            await Maintenance.findByIdAndDelete(requestId);

            // Create notification for landlord about the deletion
            const notification = new Notification({
                userId: maintenance.landlordId,
                userType: 'Landlord',
                type: 'maintenance',
                title: 'Maintenance Request Deleted',
                message: `A maintenance request has been deleted by the tenant: ${maintenance.title}`,
                relatedId: maintenance._id
            });
            await notification.save();

            // Send email to tenant about the deletion
            const emailSubject = 'Maintenance Request Deleted';
            const emailText = `
                Maintenance Request Deletion Confirmation
                
                Your maintenance request has been deleted successfully.
                
                Title: ${maintenance.title}
                Description: ${maintenance.description}
                Priority: ${maintenance.priority}
                
                If you need to create a new maintenance request, please do so through the maintenance request form.
            `;

            await sendEmail(req.user.email, emailSubject, emailText);

            res.json({
                success: true,
                message: 'Maintenance request deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error deleting maintenance request',
                error: error.message
            });
        }
    }
};

module.exports = MaintenanceController; 