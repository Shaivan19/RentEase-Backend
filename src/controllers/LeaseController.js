const Lease = require("../models/LeaseModel");
const Property = require("../models/PropertyModel");
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
    },

    // Get lease details with property information
    getLeaseWithPropertyDetails: async (req, res) => {
        try {
            const lease = await Lease.findById(req.params.id)
                .populate({
                    path: 'propertyId',
                    select: 'title description price images address amenities features status owner',
                    populate: {
                        path: 'owner',
                        select: 'username email phone'
                    }
                })
                .populate('tenantId', 'username email phone')
                .populate('landlordId', 'username email phone');

            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }

            // Update property status to booked if it's available
            if (lease.propertyId.status === 'Available') {
                await Property.findByIdAndUpdate(lease.propertyId._id, {
                    status: 'Booked'
                });
            }

            res.json({
                success: true,
                lease: lease
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    // Get all bookings for a tenant with property details
    getAllBookingsForTenant: async (req, res) => {
        try {
            const userId = req.user._id; // Get user ID from the authenticated user

            const bookings = await Lease.find({ tenantId: userId })
                .populate({
                    path: 'propertyId',
                    select: 'title description price images address amenities features status owner',
                    populate: {
                        path: 'owner',
                        select: 'username email phone'
                    }
                })
                .populate('tenantId', 'username email phone')
                .populate('landlordId', 'username email phone')
                .sort({ createdAt: -1 }); // Sort by newest first

            // Update property statuses to booked if they're available
            await Promise.all(
                bookings.map(async (booking) => {
                    if (booking.propertyId && booking.propertyId.status === 'Available') {
                        await Property.findByIdAndUpdate(booking.propertyId._id, {
                            status: 'Booked'
                        });
                    }
                })
            );

            res.json({
                success: true,
                bookings: bookings
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    }
};

module.exports = LeaseController;