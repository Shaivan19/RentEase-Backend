const Payment = require('../models/PaymentModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mailutil = require("../utils/MailUtil"); // Using your existing mail utility
const Lease = require("../models/LeaseModel");
const Notification = require("../models/NotificationModel");
const { verifyToken } = require("../middleware/authMiddleware");
const BookProperty = require('../models/BookProperty');
const Property = require('../models/PropertyModel');
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
            const { amount, paymentType, tenantId, landlordId, propertyId, description, leaseId, leaseTerms } = req.body;

            if (!amount || !paymentType || !tenantId || !landlordId || !propertyId || !leaseId || !leaseTerms) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields"
                });
            }

            const options = {
                amount: amount, // Using actual amount
                currency: "INR",
                receipt: `receipt_${Date.now()}`,
                notes: {
                    paymentType,
                    tenantId,
                    landlordId,
                    propertyId,
                    description,
                    leaseId
                }
            };

            console.log('Creating Razorpay order with options:', options);

            const order = await razorpay.orders.create(options);

            // Create a new lease document first
            const lease = new Lease({
                tenantId,
                landlordId,
                propertyId,
                startDate: new Date(leaseTerms.startDate),
                endDate: new Date(leaseTerms.endDate),
                rentAmount: leaseTerms.rentAmount,
                securityDeposit: leaseTerms.securityDeposit,
                status: 'pending',
                terms: {
                    rentAmount: leaseTerms.rentAmount,
                    securityDeposit: leaseTerms.securityDeposit,
                    duration: leaseTerms.duration || '12 months',
                    rentDueDate: leaseTerms.rentDueDate || 1,
                    maintenance: leaseTerms.maintenance || 'Tenant responsible',
                    utilities: leaseTerms.utilities || 'Tenant responsible',
                    noticePeriod: leaseTerms.noticePeriod || '1 month',
                    renewalTerms: leaseTerms.renewalTerms || 'Automatic renewal unless notice given',
                    terminationClause: leaseTerms.terminationClause || 'Standard termination terms apply'
                }
            });

            await lease.save();

            const payment = new Payment({
                tenant: tenantId,
                landlord: landlordId,
                property: propertyId,
                lease: lease._id,
                amount: amount / 100, // Convert paise to rupees
                paymentType: 'rent',
                paymentMethod: 'razorpay',
                paymentDate: new Date(),
                razorpayOrderId: order.id,
                description,
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            await payment.save();

            // Send payment initiation email to tenant
            const populatedPayment = await Payment.findById(payment._id)
                .populate('tenant')
                .populate('property');

            await mailutil.sendingMail(
                populatedPayment.tenant.email,
                "Payment Initiated - RentEase",
                `Dear ${populatedPayment.tenant.username},

Your payment of ₹${amount / 100} has been initiated for ${populatedPayment.property.name}.
Payment Details:
- Order ID: ${order.id}
- Amount: ₹${amount / 100}
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
            console.error('Error in createPaymentOrder:', error);
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
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, leaseId } = req.body;

            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            if (expectedSignature === razorpay_signature) {
                // Update payment status
                const payment = await Payment.findOneAndUpdate(
                    { razorpayOrderId: razorpay_order_id },
                    {
                        status: 'completed',
                        razorpayPaymentId: razorpay_payment_id,
                        razorpaySignature: razorpay_signature,
                        paymentDate: new Date()
                    },
                    { new: true }
                );

                if (!payment) {
                    return res.status(404).json({
                        success: false,
                        message: 'Payment not found'
                    });
                }

                // Update lease status
                const lease = await Lease.findByIdAndUpdate(
                    leaseId,
                    { status: 'active' },
                    { new: true }
                );

                // Update property status
                await Property.findByIdAndUpdate(
                    payment.propertyId,
                    { status: 'Occupied' }
                );

                // Create booking
                const booking = new BookProperty({
                    tenant: payment.tenantId,
                    landlord: payment.landlordId,
                    property: payment.propertyId,
                    status: 'booked',
                    bookingDate: new Date(),
                    startDate: payment.leaseTerms?.startDate || new Date(),
                    endDate: payment.leaseTerms?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
                    leaseTerms: {
                        rentAmount: payment.amount,
                        securityDeposit: payment.amount,
                        duration: payment.leaseTerms?.duration || '12 months',
                        rentDueDate: payment.leaseTerms?.rentDueDate || 1,
                        maintenance: payment.leaseTerms?.maintenance || 'Tenant responsible',
                        utilities: payment.leaseTerms?.utilities || 'Tenant responsible',
                        noticePeriod: payment.leaseTerms?.noticePeriod || '1 month',
                        renewalTerms: payment.leaseTerms?.renewalTerms || 'Automatic renewal unless notice given',
                        terminationClause: payment.leaseTerms?.terminationClause || 'Standard termination terms apply'
                    },
                    paymentStatus: 'completed',
                    paymentDetails: {
                        orderId: razorpay_order_id,
                        paymentId: razorpay_payment_id,
                        signature: razorpay_signature,
                        date: new Date(),
                        amount: payment.amount
                    }
                });

                await booking.save();

                // Populate the booking with property and tenant details
                const populatedBooking = await BookProperty.findById(booking._id)
                    .populate('property', 'title location price')
                    .populate('tenant', 'name email')
                    .populate('landlord', 'name email');

                res.json({
                    success: true,
                    message: 'Payment verified successfully',
                    payment,
                    booking: populatedBooking
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Invalid signature'
                });
            }
        } catch (error) {
            console.error('Error in verifyPayment:', error);
            res.status(500).json({
                success: false,
                message: error.message
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

            const payments = await BookProperty.find(query)
                .populate('property tenant')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                payments
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
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
    },

    // Setup automatic payments
    setupAutomaticPayments: async (req, res) => {
        try {
            const { leaseId, paymentDay } = req.body;
            const lease = await Lease.findById(leaseId);
            
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }

            lease.automaticPayments = true;
            lease.paymentDay = paymentDay;
            await lease.save();

            // Create notification
            const notification = new Notification({
                userId: lease.tenantId,
                userType: 'Tenant',
                type: 'payment',
                title: 'Automatic Payments Setup',
                message: 'Automatic payments have been set up for your lease',
                relatedId: lease._id
            });
            await notification.save();

            res.json(lease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get upcoming payments
    getUpcomingPayments: async (req, res) => {
        try {
            const userId = req.user._id;
            const userType = req.user.userType.toLowerCase();
            
            const query = userType === 'tenant' ? { tenantId: userId } : { landlordId: userId };
            const leases = await Lease.find(query);
            
            const leaseIds = leases.map(lease => lease._id);
            const upcomingPayments = await Payment.find({
                leaseId: { $in: leaseIds },
                status: 'pending',
                dueDate: { $gte: new Date() }
            }).sort({ dueDate: 1 });
            
            res.json(upcomingPayments);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Split payment between multiple tenants
    splitPayment: async (req, res) => {
        try {
            const { leaseId, totalAmount, totalTenants } = req.body;
            const splitAmount = totalAmount / totalTenants;
            
            const payment = new Payment({
                leaseId,
                amount: totalAmount,
                paymentType: 'rent',
                paymentMethod: 'split',
                status: 'pending',
                splitPayment: {
                    isSplit: true,
                    totalTenants,
                    splitAmount
                }
            });
            
            await payment.save();

            // Create notifications for all tenants
            const lease = await Lease.findById(leaseId);
            const notifications = Array(totalTenants).fill().map(() => new Notification({
                userId: lease.tenantId,
                userType: 'Tenant',
                type: 'payment',
                title: 'Split Payment Created',
                message: `A split payment of $${splitAmount} has been created for your lease`,
                relatedId: payment._id
            }));

            await Notification.insertMany(notifications);

            res.json(payment);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Get utility payment history
    getUtilityPayments: async (req, res) => {
        try {
            const userId = req.user._id;
            const userType = req.user.userType.toLowerCase();
            
            const query = userType === 'tenant' ? { tenantId: userId } : { landlordId: userId };
            const leases = await Lease.find(query);
            
            const leaseIds = leases.map(lease => lease._id);
            const utilityPayments = await Payment.find({
                leaseId: { $in: leaseIds },
                paymentType: 'utility'
            }).sort({ paymentDate: -1 });
            
            res.json(utilityPayments);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Make utility payment
    makeUtilityPayment: async (req, res) => {
        try {
            const { leaseId, amount, utilityType, period } = req.body;
            
            const payment = new Payment({
                leaseId,
                amount,
                paymentType: 'utility',
                paymentMethod: 'bank_transfer',
                status: 'completed',
                utilityDetails: {
                    type: utilityType,
                    period
                }
            });
            
            await payment.save();

            // Create notification
            const lease = await Lease.findById(leaseId);
            const notification = new Notification({
                userId: lease.landlordId,
                userType: 'Landlord',
                type: 'payment',
                title: 'Utility Payment Received',
                message: `A utility payment of $${amount} has been received`,
                relatedId: payment._id
            });
            await notification.save();

            res.json(payment);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Generate payment reports
    getPaymentReports: async (req, res) => {
        try {
            const userId = req.user._id;
            const userType = req.user.userType.toLowerCase();
            const { startDate, endDate } = req.query;
            
            const query = userType === 'tenant' ? { tenantId: userId } : { landlordId: userId };
            const leases = await Lease.find(query);
            
            const leaseIds = leases.map(lease => lease._id);
            const dateQuery = {
                paymentDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
            
            const payments = await Payment.find({
                leaseId: { $in: leaseIds },
                ...dateQuery
            }).sort({ paymentDate: 1 });
            
            // Generate report summary
            const report = {
                totalPayments: payments.length,
                totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
                byType: payments.reduce((acc, payment) => {
                    acc[payment.paymentType] = (acc[payment.paymentType] || 0) + payment.amount;
                    return acc;
                }, {}),
                payments
            };
            
            res.json(report);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get monthly earnings for landlord dashboard
    getLandlordEarnings: async (req, res) => {
        try {
            // Get landlord ID from the authenticated user
            const landlordId = req.user?._id;
            
            if (!landlordId) {
                console.error('No landlord ID found in request');
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized: No landlord ID found'
                });
            }

            console.log('Fetching earnings for landlord:', landlordId);
            
            // Get all completed payments for the landlord
            const payments = await Payment.find({
                landlord: landlordId,
                status: 'completed'
            }).populate('property');

            console.log('Found payments:', payments);

            // Initialize monthly data with all months
            const monthlyData = Array.from({ length: 12 }, (_, index) => {
                const date = new Date(new Date().getFullYear(), index);
                return {
                    month: date.toLocaleString('default', { month: 'short' }),
                    earnings: 0,
                    target: 0
                };
            });

            // Calculate target based on all active properties
            const properties = await Property.find({
                owner: landlordId,
                status: { $in: ['Occupied', 'Unavailable'] }
            });
            
            console.log('Found properties:', properties);
            
            // Calculate monthly target from property rents
            const monthlyTarget = properties.reduce((sum, property) => {
                return sum + (property.rent || 0);
            }, 0);

            // Set target for each month
            monthlyData.forEach(data => {
                data.target = monthlyTarget;
            });

            // Calculate actual earnings from payments
            payments.forEach(payment => {
                const month = payment.paymentDate.getMonth();
                monthlyData[month].earnings += payment.amount;
            });

            // Calculate total earnings
            const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

            console.log('Calculated monthly data:', monthlyData);
            console.log('Total earnings:', totalEarnings);
            console.log('Monthly target:', monthlyTarget);

            res.json({
                success: true,
                monthlyEarnings: monthlyData,
                totalEarnings: totalEarnings
            });
        } catch (error) {
            console.error('Error fetching landlord earnings:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching earnings data',
                error: error.message
            });
        }
    },

    // Check for new payments since last check
    checkNewPayments: async (req, res) => {
        try {
            const { lastCheck } = req.query;
            const landlordId = req.user._id;

            if (!lastCheck) {
                return res.status(400).json({
                    success: false,
                    message: "Last check timestamp is required"
                });
            }

            const newPayments = await Payment.find({
                landlord: landlordId,
                status: 'completed',
                paymentDate: { $gt: new Date(lastCheck) }
            }).populate('property tenant');

            // Transform the payments data
            const transformedPayments = newPayments.map(payment => ({
                amount: payment.amount,
                propertyId: payment.property._id,
                landlordId: payment.landlord,
                timestamp: payment.paymentDate,
                propertyName: payment.property.name,
                tenantName: payment.tenant.username
            }));

            res.json({
                success: true,
                newPayments: transformedPayments
            });
        } catch (error) {
            console.error('Error checking new payments:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking for new payments',
                error: error.message
            });
        }
    }
};

// Set up a scheduler to check pending payments daily
setInterval(PaymentController.checkPendingPayments, 24 * 60 * 60 * 1000);

module.exports = PaymentController;
