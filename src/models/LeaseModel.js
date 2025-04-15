const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    landlordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    monthlyRent: {
        type: Number,
        required: true
    },
    securityDeposit: {
        type: Number,
        required: true
    },
    leaseStatus: {
        type: String,
        enum: ['active', 'expired', 'terminated'],
        default: 'active'
    },
    paymentDueDay: {
        type: Number,
        required: true,
        min: 1,
        max: 31
    },
    utilities: [{
        name: String,
        responsibleParty: {
            type: String,
            enum: ['landlord', 'tenant']
        }
    }],
    terms: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add pre-save middleware to update the updatedAt field
leaseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Lease = mongoose.model('Lease', leaseSchema);

module.exports = Lease;