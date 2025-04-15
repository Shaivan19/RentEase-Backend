const Payment = require('../models/PaymentModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mailutil = require("../utils/MailUtil"); // Using your existing mail utility
require('dotenv').config();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PaymentController = {
    // Create a new payment order
    createPaymentOrder: async (req, res) => {
        try {
            const { amount, paymentType, tenantId, landlordId, propertyId, description } = req.body;

            const options = {
                amount: amount * 100, // Razorpay expects amount in paise
                currency: "INR",
                receipt: `receipt_${Date.now()}`
            };

            const order = await razorpay.orders.create(options);

            const payment = new Payment({
                tenant: tenantId,
                landlord: landlordId,
                property: propertyId,
                amount,
                paymentType,
                razorpayOrderId: order.id,
                description,
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            });

            await payment.save();

            // Send payment initiation email to tenant
            const tenant = await payment.populate('tenant property');
            await mailutil.sendingMail(
                tenant.tenant.email,
                "Payment Initiated - RentEase",
                `Dear ${tenant.tenant.username},

Your payment of ₹${amount} has been initiated for ${payment.property.name}.
Payment Details:
- Order ID: ${order.id}
- Amount: ₹${amount}
- Type: ${paymentType}
- Due Date: ${payment.dueDate}

Please complete the payment within 24 hours.

Best regards,
RentEase Team`
            );

            res.json({
                success: true,
                order,
                payment
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error creating payment order",
                error: error.message
            });
        }
    },

    // Verify payment
    verifyPayment: async (req, res) => {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");

            if (razorpay_signature === expectedSign) {
                const payment = await Payment.findOneAndUpdate(
                    { razorpayOrderId: razorpay_order_id },
                    { 
                        paymentStatus: 'COMPLETED',
                        razorpayPaymentId: razorpay_payment_id
                    },
                    { new: true }
                ).populate('tenant landlord property');

                // Send success email to both tenant and landlord
                await Promise.all([
                    // Email to tenant
                    mailutil.sendingMail(
                        payment.tenant.email,
                        "Payment Successful - RentEase",
                        `Dear ${payment.tenant.username},

Your payment of ₹${payment.amount} has been successfully processed.

Payment Details:
- Payment ID: ${payment.razorpayPaymentId}
- Property: ${payment.property.name}
- Payment Type: ${payment.paymentType}
- Date: ${payment.paymentDate}

Thank you for using RentEase!

Best regards,
RentEase Team`
                    ),
                    // Email to landlord
                    mailutil.sendingMail(
                        payment.landlord.email,
                        "Payment Received - RentEase",
                        `Dear ${payment.landlord.username},

A payment of ₹${payment.amount} has been received from ${payment.tenant.username}.

Payment Details:
- Payment ID: ${payment.razorpayPaymentId}
- Property: ${payment.property.name}
- Payment Type: ${payment.paymentType}
- Date: ${payment.paymentDate}

The amount will be credited to your account within 24-48 hours.

Best regards,
RentEase Team`
                    )
                ]);

                res.json({
                    success: true,
                    message: "Payment verified successfully",
                    payment
                });
            } else {
                // Send payment failure email
                const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id })
                    .populate('tenant landlord property');
                
                await mailutil.sendingMail(
                    payment.tenant.email,
                    "Payment Failed - RentEase",
                    `Dear ${payment.tenant.username},

Your payment of ₹${payment.amount} for ${payment.property.name} has failed due to signature verification issues.

Please try again or contact support if the issue persists.

Best regards,
RentEase Team`
                );

                res.status(400).json({
                    success: false,
                    message: "Invalid signature"
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error verifying payment",
                error: error.message
            });
        }
    },

    // Check for delayed/pending payments and send reminders
    checkPendingPayments: async () => {
        try {
            const pendingPayments = await Payment.find({
                paymentStatus: 'PENDING',
                dueDate: { $lte: new Date() }
            }).populate('tenant landlord property');

            for (const payment of pendingPayments) {
                // Send reminder email to tenant
                await mailutil.sendingMail(
                    payment.tenant.email,
                    "Payment Reminder - RentEase",
                    `Dear ${payment.tenant.username},

This is a reminder that your payment of ₹${payment.amount} for ${payment.property.name} is pending.

Payment Details:
- Order ID: ${payment.razorpayOrderId}
- Due Date: ${payment.dueDate}
- Amount: ₹${payment.amount}
- Type: ${payment.paymentType}

Please complete the payment as soon as possible to avoid any inconvenience.

Best regards,
RentEase Team`
                );
            }
        } catch (error) {
            console.error('Error checking pending payments:', error);
        }
    },

    // Get payment history for a user
    getPaymentHistory: async (req, res) => {
        try {
            const { userId, userType } = req.params;
            const query = userType === 'tenant' 
                ? { tenant: userId }
                : { landlord: userId };

            const payments = await Payment.find(query)
                .populate('tenant landlord property')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                payments
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error fetching payment history",
                error: error.message
            });
        }
    },

    // Get payment details
    getPaymentDetails: async (req, res) => {
        try {
            const { paymentId } = req.params;
            const payment = await Payment.findById(paymentId)
                .populate('tenant landlord property');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment not found"
                });
            }

            res.json({
                success: true,
                payment
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error fetching payment details",
                error: error.message
            });
        }
    }
};

// Set up a scheduler to check pending payments daily
setInterval(PaymentController.checkPendingPayments, 24 * 60 * 60 * 1000);

module.exports = PaymentController;