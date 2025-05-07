const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');
const { adminAuth } = require('../middleware/authMiddleware');
const { loginValidation, signupValidation, updateProfileValidation, changePasswordValidation } = require('../middleware/validationMiddleware');

// Public routes
router.post('/login', loginValidation, adminController.login);
router.post('/signup', signupValidation, adminController.signup);

// Protected routes
router.get('/profile', adminAuth, adminController.getProfile);
router.put('/profile', adminAuth, updateProfileValidation, adminController.updateProfile);
router.put('/change-password', adminAuth, changePasswordValidation, adminController.changePassword);

// User management routes
router.get('/users', adminAuth, adminController.getAllUsers);
router.delete('/users/:type/:id', adminAuth, adminController.deleteUser);

// Property management routes
router.get('/properties', adminAuth, adminController.getAllProperties);
router.put('/properties/:id', adminAuth, adminController.updateProperty);
router.delete('/properties/:id', adminAuth, adminController.deleteProperty);
router.put('/properties/:id/approve', adminAuth, adminController.approveProperty);
router.put('/properties/:id/reject', adminAuth, adminController.rejectProperty);

// Booking management routes
router.get('/bookings', adminAuth, adminController.getAllBookings);
router.put('/bookings/:id/confirm', adminAuth, adminController.confirmBooking);

// Dashboard routes
router.get('/dashboard/stats', adminAuth, adminController.getDashboardStats);

module.exports = router;
