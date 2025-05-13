const Admin = require('../models/AdminModel');
const Tenant = require('../models/TenantModel');
const Landlord = require('../models/LandlordModel');
const Property = require('../models/PropertyModel');
const BookProperty = require('../models/BookProperty');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const MailUtil = require('../utils/MailUtil');

// Get JWT secret with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'TUTU';

// Admin Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if admin is active
    if (admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    // Update last login
    admin.lastLogin = Date.now();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      token,
      admin: admin.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get Admin Profile
exports.getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update Admin Profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Update fields
    admin.name = name || admin.name;
    admin.email = email || admin.email;
    admin.updatedAt = Date.now();

    await admin.save();

    res.status(200).json({
      success: true,
      admin: admin.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get all users with details (combines tenants and landlords)
exports.getAllUsers = async (req, res) => {
  try {
    const [tenants, landlords] = await Promise.all([
      Tenant.find().select('-password').sort({ createdAt: -1 }),
      Landlord.find().select('-password').sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      users: {
        tenants,
        landlords
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete a user
exports.deleteUser = async (req, res) => {
  try {
    const { id, type } = req.params; // type can be 'tenant' or 'landlord'

    let Model;
    if (type === 'tenant') {
      Model = Tenant;
    } else if (type === 'landlord') {
      Model = Landlord;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type. Must be either tenant or landlord'
      });
    }

    // First verify the user exists
    const user = await Model.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If user is a landlord, check if they have any properties
    if (type === 'landlord') {
      const hasProperties = await Property.exists({ owner: id });
      if (hasProperties) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete landlord with active properties. Please delete or transfer their properties first.'
        });
      }
    }

    // If user is a tenant, check if they have any active bookings
    if (type === 'tenant') {
      const hasBookings = await BookProperty.exists({ 
        tenant: id,
        status: { $in: ['pending', 'booked'] }
      });
      if (hasBookings) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete tenant with active bookings. Please cancel their bookings first.'
        });
      }
    }

    // Store user info before deletion for response
    const userInfo = {
      id: user._id,
      email: user.email,
      type: type
    };

    // Perform the deletion
    const result = await Model.deleteOne({ _id: id });

    // Verify deletion was successful
    if (result.deletedCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }

    // Double check that user is actually deleted
    const userStillExists = await Model.findById(id);
    if (userStillExists) {
      return res.status(500).json({
        success: false,
        message: 'User deletion failed - user still exists in database'
      });
    }

    // Log the successful deletion
    console.log(`Successfully deleted ${type} with ID: ${id}`);

    res.status(200).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`,
      deletedUser: userInfo
    });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Get all properties
exports.getAllProperties = async (req, res) => {
  try {
    console.log('Fetching all properties...');
    
    // Verify admin authentication
    if (!req.admin) {
      console.error('Admin authentication failed');
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Admin authentication required' 
      });
    }

    const properties = await Property.find()
      .populate('owner', 'username email phone createdAt')
      .sort({ createdAt: -1 });

    console.log(`Successfully fetched ${properties.length} properties`);
    
    res.json({ 
      success: true, 
      properties,
      count: properties.length
    });
  } catch (error) {
    console.error('Error in getAllProperties:', error);
    
    // Check for specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        error: error.message 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid ID format', 
        error: error.message 
      });
    }

    // Generic server error
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching properties', 
      error: error.message 
    });
  }
};

// Get all bookings with tenant and landlord details
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await BookProperty.find()
      .populate('tenant', 'username email phone')
      .populate('landlord', 'username email phone')
      .populate('property')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Confirm a booking
exports.confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the booking
    const booking = await BookProperty.findById(id)
      .populate('tenant', 'username email')
      .populate('property', 'title location');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update booking status
    booking.status = 'booked';
    await booking.save();

    // Update property status to rented
    await Property.findByIdAndUpdate(booking.property._id, {
      status: 'rented'
    });

    // Send confirmation email to tenant
    const emailSubject = "Property Booking Confirmation";
    const emailBody = `
      Dear ${booking.tenant.username},

      Your booking for "${booking.property.title}" at ${booking.property.location} 
      has been confirmed.

      Regards,
      RentEase Team
    `;
    await MailUtil.sendingMail(booking.tenant.email, emailSubject, emailBody);

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      booking
    });
  } catch (error) {
    console.error('Error in confirmBooking:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming booking',
      error: error.message
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalTenants,
      totalLandlords,
      totalProperties,
      activeBookings,
      pendingRequests,
      recentTenants,
      recentLandlords,
      recentProperties
    ] = await Promise.all([
      Tenant.countDocuments(),
      Landlord.countDocuments(),
      Property.countDocuments(),
      BookProperty.countDocuments({ status: 'booked' }),
      BookProperty.countDocuments({ status: 'pending' }),
      Tenant.find().select('username email createdAt').sort({ createdAt: -1 }).limit(5),
      Landlord.find().select('username email createdAt').sort({ createdAt: -1 }).limit(5),
      Property.find().select('title price status createdAt').sort({ createdAt: -1 }).limit(5)
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalTenants,
        totalLandlords,
        totalProperties,
        activeBookings,
        pendingRequests,
        recentTenants,
        recentLandlords,
        recentProperties
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Admin Signup
exports.signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if admin already exists
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    // Create new admin
    admin = new Admin({
      name,
      email,
      password,
      role: 'admin', // Default role
      status: 'active'
    });

    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      token,
      admin: admin.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update property
exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const property = await Property.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).populate('owner', 'username email phone createdAt');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, property });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Delete property
exports.deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findByIdAndDelete(id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Approve property
exports.approveProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    ).populate('owner', 'username email phone createdAt');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, property });
  } catch (error) {
    console.error('Error approving property:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Reject property
exports.rejectProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findByIdAndUpdate(
      id,
      { status: 'rejected' },
      { new: true }
    ).populate('owner', 'username email phone createdAt');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, property });
  } catch (error) {
    console.error('Error rejecting property:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
