const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { verifyToken, isLandlord, isTenant } = require('../middleware/authMiddleware');

// Setup automatic payments
router.post('/payments/setup-automatic', verifyToken, isTenant, PaymentController.setupAutomaticPayments);

// Get upcoming payments
router.get('/payments/upcoming', verifyToken, PaymentController.getUpcomingPayments);

// Split payment between multiple tenants
router.post('/payments/split', verifyToken, isTenant, PaymentController.splitPayment);

// Get utility payment history
router.get('/payments/utilities', verifyToken, PaymentController.getUtilityPayments);

// Make utility payment
router.post('/payments/utilities', verifyToken, isTenant, PaymentController.makeUtilityPayment);

// Generate payment reports
router.get('/payments/reports', verifyToken, PaymentController.getPaymentReports);

// Create payment order
router.post('/payments/create-order', verifyToken, (req, res) => PaymentController.createPaymentOrder(req, res));

// Verify payment
router.post('/payments/verify', verifyToken, (req, res) => PaymentController.verifyPayment(req, res));

// Get payment history
router.get('/history/:userId/:userType', verifyToken, (req, res) => PaymentController.getPaymentHistory(req, res));

// Get landlord earnings
router.get('/payments/landlord-earnings', verifyToken, PaymentController.getLandlordEarnings);

module.exports = router; 