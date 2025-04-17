const RentProperty = require("../models/BookProperty");
const Property = require("../models/PropertyModel");
const Tenant = require("../models/TenantModel");
const Landlord = require("../models/LandlordModel");
const MailUtil = require("../utils/MailUtil");
const { generateLeaseDraft } = require('../utils/leaseGenerator');


// ✅ Book a Property
exports.bookProperty = async (req, res) => {
    try {
        console.log('=== Starting BookProperty Process ===');
        const { propertyId, tenantId, startDate, endDate, leaseTerms } = req.body;
        
        console.log('=== Booking Request Details ===');
        console.log('Property ID:', propertyId);
        console.log('Tenant ID:', tenantId);
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        console.log('Lease Terms:', leaseTerms);
        console.log('=============================');

        // Validate required fields
        if (!propertyId) {
            console.log('Validation failed: Property ID is missing');
            return res.status(400).json({
                success: false,
                message: 'Property ID is required'
            });
        }
        if (!tenantId) {
            console.log('Validation failed: Tenant ID is missing');
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required'
            });
        }
        if (!startDate) {
            console.log('Validation failed: Start date is missing');
            return res.status(400).json({
                success: false,
                message: 'Start date is required'
            });
        }
        if (!endDate) {
            console.log('Validation failed: End date is missing');
            return res.status(400).json({
                success: false,
                message: 'End date is required'
            });
        }
        if (!leaseTerms) {
            console.log('Validation failed: Lease terms are missing');
            return res.status(400).json({
                success: false,
                message: 'Lease terms are required'
            });
        }
        if (typeof leaseTerms.rentAmount !== 'number' || leaseTerms.rentAmount <= 0) {
            console.log('Validation failed: Invalid rent amount');
            return res.status(400).json({
                success: false,
                message: 'Valid rent amount is required'
            });
        }
        if (typeof leaseTerms.securityDeposit !== 'number' || leaseTerms.securityDeposit <= 0) {
            console.log('Validation failed: Invalid security deposit');
            return res.status(400).json({
                success: false,
                message: 'Valid security deposit is required'
            });
        }

        // Check if property exists and is available
        console.log('Fetching property details...');
        const property = await Property.findById(propertyId)
            .populate('owner', 'username email phone _id');
        console.log('Property found:', property ? 'Yes' : 'No');
        console.log('Property owner:', property?.owner);
        console.log('Property status:', property?.status);
        
        if (!property) {
            console.log('Property not found');
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        // Normalize the status check
        const normalizedStatus = property.status?.toLowerCase();
        console.log('Normalized property status:', normalizedStatus);
        
        if (normalizedStatus !== 'available') {
            console.log('Property is not available for booking. Current status:', property.status);
            return res.status(400).json({
                success: false,
                message: `Property is not available for booking. Current status: ${property.status}`
            });
        }

        // Check if tenant exists
        console.log('Fetching tenant details...');
        const tenant = await Tenant.findById(tenantId);
        console.log('Tenant found:', tenant ? 'Yes' : 'No');
        
        if (!tenant) {
            console.log('Tenant not found');
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        try {
            // Generate lease draft
            console.log('Generating lease draft...');
            const leaseDraft = await generateLeaseDraft({
                propertyId,
                tenantId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                terms: leaseTerms
            });
            console.log('Lease draft generated successfully');

            // Create booking with lease draft
            console.log('Creating booking...');
            const booking = new RentProperty({
                property: propertyId,
                tenant: tenantId,
                landlord: property.owner._id,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                monthlyRent: leaseTerms.rentAmount,
                securityDeposit: leaseTerms.securityDeposit,
                leaseTerms: JSON.stringify(leaseDraft),
                status: 'pending',
                paymentStatus: 'pending',
                bookingDate: new Date(),
                bookingTime: new Date().toLocaleTimeString()
            });

            await booking.save();
            console.log('Booking saved successfully');

            // Do NOT update property status here - it will be updated after payment verification

            res.status(201).json({
                success: true,
                booking,
                leaseDraft
            });
        } catch (error) {
            console.error('Error in lease generation or booking creation:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error creating booking'
            });
        }
    } catch (error) {
        console.error('Error in bookProperty:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

// Get All Bookings

exports.getAllBookings = async (req, res) => {
    try {
        const bookings = await RentProperty.find()
            .populate("property", "title location")
            .populate("tenant", "name email")
            .populate("landlord", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            bookings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Booking by ID    
exports.getBookingById = async (req, res) => {
    try {
        const booking = await RentProperty.findById(req.params.id)
            .populate("property", "title location")
            .populate("tenant", "name email")
            .populate("landlord", "name email");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Cancel a Booking
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { cancellationReason } = req.body;

        const booking = await RentProperty.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        booking.status = "cancelled";
        booking.cancellationReason = cancellationReason || "No reason provided";
        await booking.save();

        // Send cancellation email to tenant
        const emailSubject = "Property Booking Cancellation Confirmation";
        const emailBody = `
            Dear ${booking.tenant.name},

            Your booking for "${booking.property.title}" at ${booking.property.location} 
            has been cancelled. Reason: ${booking.cancellationReason}.

            Regards,  
            RentEase Team
        `;
        await MailUtil.sendingMail(booking.tenant.email, emailSubject, emailBody);

        res.status(200).json({ message: "Booking cancelled successfully", booking });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update a Booking 
exports.updateBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { bookingDate, bookingTime, message } = req.body;

        const booking = await RentProperty.findById(bookingId);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        booking.bookingDate = bookingDate || booking.bookingDate;
        booking.bookingTime = bookingTime || booking.bookingTime;
        booking.message = message || booking.message;
        await booking.save();

        res.status(200).json({ message: "Booking updated successfully", booking });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

//DELETE BOOKING
exports.deleteBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await RentProperty.findByIdAndDelete(bookingId);

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;

        const booking = await RentProperty.findByIdAndUpdate(
            bookingId,
            { status },
            { new: true }
        ).populate('property tenant');

        if (status === 'active') {
            await Property.findByIdAndUpdate(booking.property._id, {
                status: 'rented'
            });
        }

        res.json({
            success: true,
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.verifyPaymentAndUpdateStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Find the booking
        const booking = await RentProperty.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Update booking status
        booking.status = 'booked';
        booking.paymentStatus = 'completed';
        booking.paymentDetails = {
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature,
            date: new Date()
        };
        await booking.save();

        // Update property status
        await Property.findByIdAndUpdate(booking.property, {
            status: 'booked'
        });

        res.json({
            success: true,
            message: 'Payment verified and status updated successfully',
            booking
        });
    } catch (error) {
        console.error('Error in verifyPaymentAndUpdateStatus:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error verifying payment and updating status'
        });
    }
};

// Generate lease draft without creating a booking
exports.generateLeaseDraft = async (req, res) => {
    try {
        console.log('=== Starting Lease Draft Generation ===');
        const { propertyId, tenantId, startDate, endDate, leaseTerms } = req.body;
        
        console.log('=== Lease Draft Request Details ===');
        console.log('Property ID:', propertyId);
        console.log('Tenant ID:', tenantId);
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);
        console.log('Lease Terms:', leaseTerms);
        console.log('=============================');

        // Validate required fields
        if (!propertyId || !tenantId || !startDate || !endDate || !leaseTerms) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if property exists and is available
        const property = await Property.findById(propertyId)
            .populate('owner', 'username email phone _id');
        
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        // Check if tenant exists
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Generate lease draft
        const leaseDraft = await generateLeaseDraft({
            propertyId,
            tenantId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            terms: leaseTerms
        });

        res.status(200).json({
            success: true,
            leaseDraft
        });
    } catch (error) {
        console.error('Error in generateLeaseDraft:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};