const Visit = require("../models/VisitpropertyModel");
const Property = require("../models/PropertyModel");
const Tenant = require("../models/TenantModel");
const MailUtil = require("../utils/MailUtil");

// ✅ Schedule a Visit
exports.scheduleVisit = async (req, res) => {
  try {
    const { property, tenant, visitDate, visitTime, message } = req.body;

    // Check if property exists
    const existingProperty = await Property.findById(property);
    if (!existingProperty) return res.status(404).json({ message: "Property not found" });

    // Check if tenant exists
    const visitor = await Tenant.findById(tenant);
    if (!visitor) return res.status(404).json({ message: "Tenant not found" });

    // Create a new visit request
    const newVisit = new Visit({
      tenant,
      landlord: existingProperty.owner,
      property,
      visitDate,
      visitTime,
      message,
      status: "scheduled",
    });

    await newVisit.save();

    // Send email confirmation
    const emailSubject = "Visit Scheduled Confirmation";
    const emailBody = `
      Dear ${visitor.name},

      Your visit to "${existingProperty.title}" at ${existingProperty.location} 
      is scheduled for ${visitDate} at ${visitTime}.

      Regards,  
      RentEase Team
    `;
    await MailUtil.sendingMail(visitor.email, emailSubject, emailBody);

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
      .populate("property", "title location")
      .populate("tenant", "name email");

    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Get Visit by ID
exports.getVisitById = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate("property", "title location")
      .populate("tenant", "name email");

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reschedule a Visit
exports.rescheduleVisit = async (req, res) => {
  try {
    const { newVisitDate, newVisitTime } = req.body;
    const visit = await Visit.findById(req.params.id).populate("tenant", "email name");

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    // Ensure new date is valid (not in the past)
    const currentDate = new Date();
    if (new Date(newVisitDate) < currentDate) {
      return res.status(400).json({ message: "New visit date must be in the future" });
    }

    // Store old visit date/time before rescheduling
    visit.previousVisitDate = visit.visitDate;
    visit.previousVisitTime = visit.visitTime;
    visit.visitDate = newVisitDate;
    visit.visitTime = newVisitTime;
    visit.status = "rescheduled";

    await visit.save();

    // Ensure tenant email exists before sending email
    if (!visit.tenant || !visit.tenant.email) {
      return res.status(400).json({ message: "Tenant email not found, cannot send email" });
    }

    // Send reschedule email
    const emailSubject = "Visit Rescheduled";
    const emailBody = `
      Dear ${visit.tenant.name},

      Your visit has been **rescheduled**.
      **New Date & Time:** ${newVisitDate} at ${newVisitTime}

      If you have any concerns, please contact the landlord.

      Regards,  
      RentEase Team
    `;

    console.log(`📩 Sending email to: ${visit.tenant.email}`);
    await MailUtil.sendingMail(visit.tenant.email, emailSubject, emailBody);

    res.status(200).json({ message: "Visit rescheduled successfully, email sent!", visit });
  } catch (error) {
    console.error("🔥 Error rescheduling visit:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Cancel a Visit (Update status instead of deleting)
exports.cancelVisit = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    // Populate tenant details
    const visit = await Visit.findById(req.params.id).populate("tenant", "email name");

    if (!visit) return res.status(404).json({ message: "Visit not found" });

    // Check if the tenant has an email
    if (!visit.tenant || !visit.tenant.email) {
      return res.status(400).json({ message: "Tenant email not found" });
    }

    // Update visit status
    visit.status = "cancelled";
    visit.cancellationReason = cancellationReason;
    await visit.save();

    // Send cancellation email
    const emailSubject = "Visit Cancelled";
    const emailBody = `
      Dear ${visit.tenant.name},

      Your visit has been cancelled.
      Reason: ${cancellationReason}

      Regards,  
      RentEase Team
    `;

    await MailUtil.sendingMail(visit.tenant.email, emailSubject, emailBody);

    res.status(200).json({ message: "Visit cancelled successfully", visit });
  } catch (error) {
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

