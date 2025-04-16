const Visit = require("../models/VisitpropertyModel");
const Property = require("../models/PropertyModel");
const Tenant = require("../models/TenantModel");
const Landlord = require("../models/LandlordModel");
const MailUtil = require("../utils/MailUtil");

// ✅ Schedule a Visit
exports.scheduleVisit = async (req, res) => {
  try {
    const { property, tenant, visitDate, visitTime, message, tenantName } = req.body;

    // Check if property exists
    const existingProperty = await Property.findById(property).populate('owner');
    if (!existingProperty) return res.status(404).json({ message: "Property not found" });

    // Check if tenant exists
    const visitor = await Tenant.findById(tenant);
    if (!visitor) return res.status(404).json({ message: "Tenant not found" });

    // Create a new visit request
    const newVisit = new Visit({
      tenant,
      landlord: existingProperty.owner._id,
      property,
      visitDate,
      visitTime,
      message,
      status: "scheduled",
    });

    await newVisit.save();

    // Send email to tenant
    const tenantEmailSubject = "Visit Scheduled Confirmation";
    const tenantEmailBody = `
      Dear ${tenantName || visitor.username || 'Tenant'},

      Your visit to "${existingProperty.title}" at ${existingProperty.location} 
      is scheduled for ${visitDate} at ${visitTime}.

      Regards,  
      RentEase Team
    `;
    await MailUtil.sendingMail(visitor.email, tenantEmailSubject, tenantEmailBody);

    // Send email to landlord
    const landlordEmailSubject = "New Property Visit Request";
    const landlordEmailBody = `
      Dear ${existingProperty.owner.username || 'Landlord'},

      A tenant named ${tenantName || visitor.username} has requested to visit your property 
      "${existingProperty.title}" at ${existingProperty.location} 
      on ${visitDate} at ${visitTime}.

      Please review and confirm this visit request.

      Regards,
      RentEase Team
    `;
    await MailUtil.sendingMail(existingProperty.owner.email, landlordEmailSubject, landlordEmailBody);

    res.status(201).json({ message: "Visit scheduled successfully", visit: newVisit });
  } catch (error) {
    console.error("Error scheduling visit:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Get All Visits
exports.getAllVisits = async (req, res) => {
  try {
    const visits = await Visit.find()
      .populate({
        path: "property",
        select: "title location propertyImages images imageUrls propertyImage"
      })
      .populate("tenant", "name email username");

    // Debug log to see what data we're getting
    console.log("Visit data with property:", JSON.stringify(visits[0]?.property, null, 2));

    res.status(200).json(visits);
  } catch (error) {
    console.error("Error fetching visits:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Get Visit by ID
exports.getVisitById = async (req, res) => {
  try {
    const { visitId } = req.params;
    const visit = await Visit.findById(visitId)
      .populate("property", "title location propertyImages")
      .populate("tenant", "name email username");

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reschedule a Visit
exports.rescheduleVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { visitDate, visitTime, message } = req.body;

    const visit = await Visit.findById(visitId)
      .populate('tenant', 'username email')
      .populate('property', 'title location')
      .populate('landlord', 'username email');

    if (!visit) {
      return res.status(404).json({ message: "Visit not found" });
    }

    // Store previous date and time
    visit.previousVisitDate = visit.visitDate;
    visit.previousVisitTime = visit.visitTime;
    visit.visitDate = visitDate;
    visit.visitTime = visitTime;
    visit.status = "rescheduled";
    if (message) visit.message = message;

    await visit.save();

    // Send email to landlord about rescheduling
    const landlordEmailSubject = "Visit Rescheduled";
    const landlordEmailBody = `
      Dear ${visit.landlord.username || 'Landlord'},

      The visit to your property "${visit.property.title}" by ${visit.tenant.username} 
      has been rescheduled to ${visitDate} at ${visitTime}.

      Previous schedule was ${visit.previousVisitDate} at ${visit.previousVisitTime}.

      Regards,
      RentEase Team
    `;
    await MailUtil.sendingMail(visit.landlord.email, landlordEmailSubject, landlordEmailBody);

    res.json({ message: "Visit rescheduled successfully", visit });
  } catch (error) {
    console.error("Error rescheduling visit:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Cancel a Visit
exports.cancelVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { cancellationReason } = req.body;

    const visit = await Visit.findById(visitId)
      .populate('tenant', 'username email')
      .populate('property', 'title location')
      .populate('landlord', 'username email');

    if (!visit) {
      return res.status(404).json({ message: "Visit not found" });
    }

    visit.status = "cancelled";
    visit.cancellationReason = cancellationReason;
    await visit.save();

    // Send email to landlord about cancellation
    const landlordEmailSubject = "Visit Cancelled";
    const landlordEmailBody = `
      Dear ${visit.landlord.username || 'Landlord'},

      The visit to your property "${visit.property.title}" by ${visit.tenant.username} 
      has been cancelled.

      Reason for cancellation: ${cancellationReason || 'Not specified'}

      Regards,
      RentEase Team
    `;
    await MailUtil.sendingMail(visit.landlord.email, landlordEmailSubject, landlordEmailBody);

    res.json({ message: "Visit cancelled successfully", visit });
  } catch (error) {
    console.error("Error cancelling visit:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Update Visit Details
exports.updateVisit = async (req, res) => {
  try {
    const { visitDate, visitTime, message } = req.body;
    const visit = await Visit.findById(req.params.id);

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    // Update visit details
    visit.visitDate = visitDate || visit.visitDate;
    visit.visitTime = visitTime || visit.visitTime;
    visit.message = message || visit.message;

    await visit.save();

    res.status(200).json({ message: "Visit updated successfully", visit });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//delete visit
exports.deleteVisit = async (req, res) => {
  try {
    const visit = await Visit.findByIdAndDelete(req.params.id);

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    res.status(200).json({ message: "Visit deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//get all visits by tenant id
exports.getVisitsByTenantId = async (req, res) => {
  try {
    const tenantId = req.params.id;
    const visits = await Visit.find({ tenant: tenantId })
      .populate("property", "title location")
      .populate("tenant", "name email");

    if (!visits || visits.length === 0) return res.status(404).json({ message: "No visits found" });

    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete visit permanently
exports.deleteVisitPermanently = async (req, res) => {
  try {
    const { visitId } = req.params;
    const visit = await Visit.findById(visitId);

    if (!visit) {
      return res.status(404).json({ message: "Visit not found" });
    }

    // Allow deletion of both cancelled and rejected visits
    if (visit.status !== "cancelled" && visit.status !== "rejected") {
      return res.status(400).json({ 
        message: "Only cancelled or rejected visits can be removed from the list" 
      });
    }

    await Visit.findByIdAndDelete(visitId);
    res.status(200).json({ 
      message: "Visit removed from list successfully" 
    });
  } catch (error) {
    console.error("Error deleting visit:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Confirm a Visit
exports.confirmVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const visit = await Visit.findById(visitId)
      .populate('tenant', 'username email')
      .populate('property', 'title location')
      .populate('landlord', 'username email');

    if (!visit) {
      return res.status(404).json({ message: "Visit not found" });
    }

    visit.status = "confirmed";
    await visit.save();

    // Send email to tenant about confirmation
    const tenantEmailSubject = "Visit Confirmed";
    const tenantEmailBody = `
      Dear ${visit.tenant.username || 'Tenant'},

      Your visit request for "${visit.property.title}" has been confirmed by the landlord.
      
      Visit Details:
      - Date: ${visit.visitDate}
      - Time: ${visit.visitTime}
      - Location: ${visit.property.location}

      Please arrive on time for your visit.

      Regards,
      RentEase Team
    `;
    await MailUtil.sendingMail(visit.tenant.email, tenantEmailSubject, tenantEmailBody);

    res.json({ 
      success: true,
      message: "Visit confirmed successfully", 
      visit 
    });
  } catch (error) {
    console.error("Error confirming visit:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};

// ✅ Reject a Visit
exports.rejectVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const visit = await Visit.findById(visitId)
      .populate('tenant', 'username email')
      .populate('property', 'title location')
      .populate('landlord', 'username email');

    if (!visit) {
      return res.status(404).json({ message: "Visit not found" });
    }

    visit.status = "rejected";
    await visit.save();

    // Send email to tenant about rejection
    const tenantEmailSubject = "Visit Request Rejected";
    const tenantEmailBody = `
      Dear ${visit.tenant.username || 'Tenant'},

      We regret to inform you that your visit request for "${visit.property.title}" has been rejected by the landlord.

      Visit Details:
      - Date: ${visit.visitDate}
      - Time: ${visit.visitTime}
      - Location: ${visit.property.location}

      You can try to schedule another visit at a different time.

      Regards,
      RentEase Team
    `;
    await MailUtil.sendingMail(visit.tenant.email, tenantEmailSubject, tenantEmailBody);

    res.json({ 
      success: true,
      message: "Visit rejected successfully", 
      visit 
    });
  } catch (error) {
    console.error("Error rejecting visit:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};

