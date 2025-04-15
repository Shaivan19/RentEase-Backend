const bookPropertySchema = require("../models/BookProperty");
const Property = require("../models/PropertyModel");
const Tenant = require("../models/TenantModel");
const Landlord = require("../models/LandlordModel");
const MailUtil = require("../utils/MailUtil");


// ✅ Book a Property
exports.bookProperty = async (req, res) => {
    try{
        const { property, tenant, bookingDate, bookingTime, message } = req.body;

        //check if property exists
        const existingProperty = await Property.findById(property);
        if (!existingProperty) return res.status(404).json({ message: "Property not found" });

        //check if tenant exists
        const existingTenant = await Tenant.findById(tenant);
        if (!existingTenant) return res.status(404).json({ message: "Tenant not found" });

        //check if landlord exists
        const existingLandlord = await Landlord.findById(existingProperty.owner);
        if (!existingLandlord) return res.status(404).json({ message: "Landlord not found" });

        //Lets create a new booking request

        const newBooking = new bookPropertySchema({
            tenant,
            landlord: existingProperty.owner,
            property,
            bookingDate,
            bookingTime,
            message,
            status: "booked",
        });
        await newBooking.save();

        //sending mail confirmatopn of booing

        const emailSubject = "Property Booking Confirmation";
        const emailBody =`
            Dear ${existingTenant.name},

            Your booking for "${existingProperty.title}" at ${existingProperty.location} 
            is confirmed for ${bookingDate} at ${bookingTime}.

            Regards,  
            RentEase Team
        `;
        await MailUtil.sendingMail(existingTenant.email, emailSubject, emailBody);
        res.status(201).json({ message: "Property booked successfully", booking: newBooking });

    } catch (error){
        res.status(500).json({message: "Server error", error: error.message });
    }
};

// Get All Bookings

exports.getAllBookings = async (req, res) => {
    try {
        const bookings = await bookPropertySchema.find()
            .populate("property", "title location")
            .populate("tenant", "name email")
            .populate("landlord", "name email");

        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get Booking by ID    
exports.getBookingById = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await bookPropertySchema.findById(bookingId)
            .populate("property", "title location")
            .populate("tenant", "name email")
            .populate("landlord", "name email");

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        res.status(200).json(booking);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Cancel a Booking
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { cancellationReason } = req.body;

        const booking = await bookPropertySchema.findById(bookingId);
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

        const booking = await bookPropertySchema.findById(bookingId);
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
        const booking = await bookPropertySchema.findByIdAndDelete(bookingId);

        if (!booking) return res.status(404).json({ message: "Booking not found" });

        res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};