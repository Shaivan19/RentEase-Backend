const express = require('express');
const router = express.Router();
const BookPropertyController = require('../controllers/BookpropertyController');
const { verifyToken } = require('../middleware/authMiddleware');

// Generate lease draft
router.post('/generate-lease', verifyToken, BookPropertyController.generateLeaseDraft);

// Book a property and generate lease
router.post('/book/new', verifyToken, BookPropertyController.bookProperty);

// Update booking status after payment verification
router.put('/book/verify-payment/:bookingId', verifyToken, BookPropertyController.verifyPaymentAndUpdateStatus);

// Update booking status
router.put('/book/update/:id', verifyToken, BookPropertyController.updateBookingStatus);

// Get all bookings
router.get('/allbookings', verifyToken, BookPropertyController.getAllBookings);

// Get booking by ID
router.get('/book/:id', verifyToken, BookPropertyController.getBookingById);

module.exports = router;