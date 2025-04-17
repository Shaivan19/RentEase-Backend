const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'reviewerType',
        required: true
    },
    reviewerType: {
        type: String,
        enum: ['Tenant', 'Landlord'],
        required: true
    },
    reviewType: {
        type: String,
        enum: ['property', 'landlord', 'tenant'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: {
        type: String,
        required: true
    },
    images: [{
        url: String,
        description: String
    }],
    isAnonymous: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
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

ReviewSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Review", ReviewSchema); 