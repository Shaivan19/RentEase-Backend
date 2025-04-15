const express = require('express');
const router = express.Router();
const BookPropertyController = require('../controllers/BookpropertyController');

router.post('/book/new', BookPropertyController.bookProperty);
router.put('/book/update/:id', BookPropertyController.updateBooking);
router.delete('/book/cancel/:id', BookPropertyController.cancelBooking);
router.get('/allbookings', BookPropertyController.getAllBookings);
router.get('/book/:id', BookPropertyController.getBookingById);


module.exports = router;