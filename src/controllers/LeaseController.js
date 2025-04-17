const Lease = require("../models/LeaseModel");
const Notification = require("../models/NotificationModel");
const { verifyToken } = require("../middleware/authMiddleware");

const LeaseController = {
    // Create new lease agreement
    createLease: async (req, res) => {
        try {
            const lease = new Lease(req.body);
            await lease.save();

            // Create notification for tenant
            const notification = new Notification({
                userId: lease.tenantId,
                userType: 'Tenant',
                type: 'lease',
                title: 'New Lease Agreement',
                message: 'A new lease agreement has been created for your review',
                relatedId: lease._id
            });
            await notification.save();

            res.status(201).json(lease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get lease agreement details
    getLeaseById: async (req, res) => {
        try {
            const lease = await Lease.findById(req.params.id)
                .populate('propertyId')
                .populate('tenantId')
                .populate('landlordId');
            
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }
            
            res.json(lease);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Sign lease agreement
    signLease: async (req, res) => {
        try {
            const lease = await Lease.findById(req.params.id);
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }

            const userType = req.user.userType.toLowerCase();
            if (userType === 'tenant') {
                lease.tenantSignature = req.body.signature;
            } else if (userType === 'landlord') {
                lease.landlordSignature = req.body.signature;
            }

            if (lease.tenantSignature && lease.landlordSignature) {
                lease.status = 'active';
                lease.signedDate = new Date();
            }

            await lease.save();

            // Create notification for the other party
            const otherPartyId = userType === 'tenant' ? lease.landlordId : lease.tenantId;
            const otherPartyType = userType === 'tenant' ? 'Landlord' : 'Tenant';
            
            const notification = new Notification({
                userId: otherPartyId,
                userType: otherPartyType,
                type: 'lease',
                title: 'Lease Agreement Signed',
                message: 'The lease agreement has been signed by the other party',
                relatedId: lease._id
            });
            await notification.save();

            res.json(lease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get user's lease agreements
    getUserLeases: async (req, res) => {
        try {
            const userId = req.params.userId;
            const userType = req.user.userType.toLowerCase();
            
            const query = userType === 'tenant' ? { tenantId: userId } : { landlordId: userId };
            const leases = await Lease.find(query)
                .populate('propertyId')
                .populate('tenantId')
                .populate('landlordId');
            
            res.json(leases);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Renew lease agreement
    renewLease: async (req, res) => {
        try {
            const lease = await Lease.findById(req.params.id);
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }

            const { startDate, endDate, rentAmount } = req.body;
            
            // Create new lease based on existing one
            const newLease = new Lease({
                ...lease.toObject(),
                _id: undefined,
                startDate,
                endDate,
                rentAmount,
                status: 'pending',
                landlordSignature: null,
                tenantSignature: null,
                signedDate: null
            });

            await newLease.save();

            // Create notifications
            const notifications = [
                new Notification({
                    userId: lease.tenantId,
                    userType: 'Tenant',
                    type: 'lease',
                    title: 'Lease Renewal',
                    message: 'Your lease has been renewed. Please review and sign the new agreement',
                    relatedId: newLease._id
                }),
                new Notification({
                    userId: lease.landlordId,
                    userType: 'Landlord',
                    type: 'lease',
                    title: 'Lease Renewal',
                    message: 'A lease has been renewed. Please review and sign the new agreement',
                    relatedId: newLease._id
                })
            ];

            await Notification.insertMany(notifications);

            res.json(newLease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get lease renewal reminders
    getLeaseReminders: async (req, res) => {
        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            const leases = await Lease.find({
                endDate: { $lte: thirtyDaysFromNow },
                status: 'active'
            }).populate('tenantId').populate('landlordId');

            res.json(leases);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Terminate lease agreement
    terminateLease: async (req, res) => {
        try {
            const lease = await Lease.findById(req.params.id);
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }

            lease.status = 'terminated';
            await lease.save();

            // Create notifications
            const notifications = [
                new Notification({
                    userId: lease.tenantId,
                    userType: 'Tenant',
                    type: 'lease',
                    title: 'Lease Terminated',
                    message: 'Your lease agreement has been terminated',
                    relatedId: lease._id
                }),
                new Notification({
                    userId: lease.landlordId,
                    userType: 'Landlord',
                    type: 'lease',
                    title: 'Lease Terminated',
                    message: 'A lease agreement has been terminated',
                    relatedId: lease._id
                })
            ];

            await Notification.insertMany(notifications);

            res.json(lease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

module.exports = LeaseController;