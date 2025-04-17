const Application = require("../models/ApplicationModel");
const Notification = require("../models/NotificationModel");
const { verifyToken } = require("../middleware/authMiddleware");

const ApplicationController = {
    // Submit rental application
    submitApplication: async (req, res) => {
        try {
            const application = new Application(req.body);
            await application.save();

            // Create notification for landlord
            const notification = new Notification({
                userId: application.propertyId.landlordId,
                userType: 'Landlord',
                type: 'application',
                title: 'New Rental Application',
                message: 'A new rental application has been submitted for your property',
                relatedId: application._id
            });
            await notification.save();

            res.status(201).json(application);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get application details
    getApplicationById: async (req, res) => {
        try {
            const application = await Application.findById(req.params.id)
                .populate('propertyId')
                .populate('tenantId');
            
            if (!application) {
                return res.status(404).json({ message: 'Application not found' });
            }
            
            res.json(application);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get user's applications
    getUserApplications: async (req, res) => {
        try {
            const applications = await Application.find({ tenantId: req.params.userId })
                .populate('propertyId')
                .sort({ applicationDate: -1 });
            
            res.json(applications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get applications for a property
    getPropertyApplications: async (req, res) => {
        try {
            const applications = await Application.find({ propertyId: req.params.propertyId })
                .populate('tenantId')
                .sort({ applicationDate: -1 });
            
            res.json(applications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Update application status
    updateApplicationStatus: async (req, res) => {
        try {
            const { status } = req.body;
            const application = await Application.findById(req.params.id);
            
            if (!application) {
                return res.status(404).json({ message: 'Application not found' });
            }

            application.status = status;
            await application.save();

            // Create notification for tenant
            const notification = new Notification({
                userId: application.tenantId,
                userType: 'Tenant',
                type: 'application',
                title: 'Application Status Updated',
                message: `Your application status has been updated to ${status}`,
                relatedId: application._id
            });
            await notification.save();

            res.json(application);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

module.exports = ApplicationController; 