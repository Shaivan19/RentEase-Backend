const jwt = require('jsonwebtoken');
const Admin = require('../models/AdminModel');
const Landlord = require('../models/LandlordModel');
const Tenant = require('../models/TenantModel');

// Get JWT secret with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'TUTU';

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; 

        if (!token) {
            return res.status(403).json({ 
                success: false,
                message: "Access denied. No token provided." 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded);

        // Find the user based on their type
        let user;
        if (decoded.userType === 'Landlord') {
            user = await Landlord.findById(decoded.id);
        } else if (decoded.userType === 'Tenant') {
            user = await Tenant.findById(decoded.id);
        }

        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: "User not found." 
            });
        }

        // Add user to request object
        req.user = {
            _id: user._id,
            userType: decoded.userType,
            ...user.toObject()
        };

        console.log('User set in request:', req.user);
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ 
            success: false,
            message: "Invalid token.",
            error: error.message 
        });
    }
};

// Middleware to check if user is a landlord
const isLandlord = (req, res, next) => {
    if (req.user && req.user.userType === 'Landlord') {
        next();
    } else {
        res.status(403).json({ 
            success: false,
            message: "Access denied. Landlord privileges required." 
        });
    }
};

// Middleware to check if user is a tenant
const isTenant = (req, res, next) => {
    if (req.user && req.user.userType === 'Tenant') {
        next();
    } else {
        res.status(403).json({ 
            success: false,
            message: "Access denied. Tenant privileges required." 
        });
    }
};

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        // Get token from header (try both cases)
        const authHeader = req.headers.authorization || req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token, authorization denied' 
            });
        }

        const token = authHeader.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token, authorization denied' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded); // Debug log

        // Check if admin exists and is active
        const admin = await Admin.findOne({ 
            _id: decoded.id, 
            status: 'active' 
        });

        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin not found or inactive' 
            });
        }

        // Add admin to request object
        req.admin = admin;
        next();
    } catch (error) {
        console.error('Auth error:', error); // Debug log
        res.status(401).json({ 
            success: false, 
            message: 'Token is not valid',
            error: error.message 
        });
    }
};

// Export all middleware functions
module.exports = {
    verifyToken,
    isLandlord,
    isTenant,
    adminAuth
}; 