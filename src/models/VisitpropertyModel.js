const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    tenant: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Tenant", 
      required: true 
    }, 
    landlord: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Landlord", 
      required: true 
    }, 
    property: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Property", 
      required: true 
    }, 
    visitDate: { 
      type: Date, 
      required: true 
    }, 
    visitTime: { 
      type: String, 
      required: true 
    }, 
    previousVisitDate: { 
      type: Date 
    }, // Store old date when rescheduled
    previousVisitTime: { 
      type: String 
    }, // Store old time when rescheduled
    status: { 
      type: String, 
      enum: ["scheduled", "rescheduled", "completed", "cancelled", "rejected", "confirmed"], 
      default: "scheduled" 
    },
    message: { 
      type: String, 
      trim: true 
    }, //store message from tenant to landlord
    cancellationReason: { 
      type: String, 
      trim: true 
    } // Store reason if visit is cancelled
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
