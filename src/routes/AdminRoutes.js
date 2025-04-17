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

// New protected routes for admin dashboard
router.get('/users', adminAuth, adminController.getAllUsers);
router.get('/properties', adminAuth, adminController.getAllProperties);
router.get('/bookings', adminAuth, adminController.getAllBookings);
router.get('/dashboard/stats', adminAuth, adminController.getDashboardStats);

// Admin property management routes
router.put('/properties/:id', adminAuth, adminController.updateProperty);
router.delete('/properties/:id', adminAuth, adminController.deleteProperty);
router.put('/properties/:id/approve', adminAuth, adminController.approveProperty);
router.put('/properties/:id/reject', adminAuth, adminController.rejectProperty);

module.exports = router;
