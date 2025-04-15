const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    landlord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Landlord',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
    },
    images: [{
        type: String // URLs of uploaded images
    }],
    estimatedCost: {
        type: Number,
        default: 0
    },
    actualCost: {
        type: Number,
        default: 0
    },
    assignedTo: {
        type: String, // Name or ID of maintenance person/company
        default: null
    },
    scheduledDate: {
        type: Date,
        default: null
    },
    completionDate: {
        type: Date,
        default: null
    },
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'comments.userType'
        },
        userType: {
            type: String,
            enum: ['Tenant', 'Landlord']
        },
        text: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
module.exports = Maintenance;