const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'withdrawn'],
        default: 'pending'
    },
    applicationDate: {
        type: Date,
        default: Date.now
    },
    moveInDate: {
        type: Date,
        required: true
    },
    employmentStatus: {
        type: String,
        required: true
    },
    monthlyIncome: {
        type: Number,
        required: true
    },
    references: [{
        name: String,
        relationship: String,
        phone: String,
        email: String
    }],
    additionalNotes: String,
    documents: [{
        type: String,
        url: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

ApplicationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Application", ApplicationSchema);