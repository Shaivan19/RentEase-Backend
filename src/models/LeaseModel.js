const mongoose = require('mongoose');

const LeaseSchema = new mongoose.Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    landlordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Landlord',
        required: true
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
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
    rentAmount: {
        type: Number,
        required: true
    },
    securityDeposit: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'expired', 'terminated', 'renewed'],
        default: 'pending'
    },
    terms: {
        rentAmount: {
            type: Number,
            required: true
        },
        securityDeposit: {
            type: Number,
            required: true
        },
        duration: {
            type: String,
            required: true
        },
        rentDueDate: {
            type: Number,
            required: true
        },
        maintenance: {
            type: String,
            default: 'Tenant responsible'
        },
        utilities: {
            type: String,
            default: 'Tenant responsible'
        },
        noticePeriod: {
            type: String,
            default: '1 month'
        },
        renewalTerms: {
            type: String,
            default: 'Automatic renewal unless notice given'
        },
        terminationClause: {
            type: String,
            default: 'Standard termination terms apply'
        }
    },
    landlordSignature: {
        type: String,
        default: null
    },
    tenantSignature: {
        type: String,
        default: null
    },
    signedDate: {
        type: Date,
        default: null
    },
    automaticPayments: {
        type: Boolean,
        default: false
    },
    paymentDay: {
        type: Number,
        min: 1,
        max: 31
    },
    utilitiesIncluded: {
        type: Boolean,
        default: false
    },
    utilitiesAmount: {
        type: Number,
        default: 0
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
LeaseSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Lease", LeaseSchema);