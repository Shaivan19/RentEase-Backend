const mongoose = require('mongoose');

const MaintenanceSchema = new mongoose.Schema({
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
    landlordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Landlord',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'emergency'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    images: [{
        url: String,
        description: String
    }],
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider'
    },
    estimatedCost: {
        type: Number,
        default: 0
    },
    actualCost: {
        type: Number,
        default: 0
    },
    completionDate: Date,
    comments: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'comments.userType'
        },
        userType: {
            type: String,
            enum: ['Tenant', 'Landlord', 'ServiceProvider']
        },
        comment: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
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

MaintenanceSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Add index for better query performance
MaintenanceSchema.index({ propertyId: 1, status: 1 });
MaintenanceSchema.index({ tenantId: 1, status: 1 });
MaintenanceSchema.index({ landlordId: 1, status: 1 });

const Maintenance = mongoose.model('Maintenance', MaintenanceSchema);
module.exports = Maintenance;
