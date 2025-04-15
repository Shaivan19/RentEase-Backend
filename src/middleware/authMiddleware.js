const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; 

    if (!token) {
        return res.status(403).json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token." });
    }
};

// Middleware to check if user is a landlord
const isLandlord = (req, res, next) => {
    if (req.user && req.user.userType === 'Landlord') {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Landlord privileges required." });
    }
};

// Middleware to check if user is a tenant
const isTenant = (req, res, next) => {
    if (req.user && req.user.userType === 'Tenant') {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Tenant privileges required." });
    }
};

module.exports = {
    verifyToken,
    isLandlord,
    isTenant
}; 