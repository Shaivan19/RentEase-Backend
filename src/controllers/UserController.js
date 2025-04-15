const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Tenant = require("../models/TenantModel");
const Landlord = require("../models/LandlordModel");
// const mailutil = require("../utils/MailUtil");
const { sendingMail } = require("../utils/MailUtil");
const multer = require("multer");
const path = require("path");
const crypto = require('crypto');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

//------------------------> User Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let foundUser = await Tenant.findOne({ email });
    let userType = "Tenant";

    if (!foundUser) {
      foundUser = await Landlord.findOne({ email });
      userType = "Landlord";
    }

    if (!foundUser) {
      return res.status(404).json({ message: "Email not found." });
    }

    const isMatch = await bcrypt.compare(password, foundUser.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { 
        id: foundUser._id,
        userType,
        email: foundUser.email
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: `Login successful. Welcome ${userType}!`,
      userType,
      token,
      data: {
        userId: foundUser._id,
        username: foundUser.username,
        phone: foundUser.phone || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error during login.", error: error.message });
  }
};

//-----------------> User Signup
const signup = async (req, res) => {
  try {
    const { username, email, password, userType, phone } = req.body;

    const existingTenant = await Tenant.findOne({ email });
    const existingLandlord = await Landlord.findOne({ email });

    if (existingTenant || existingLandlord) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let newUser;

    if (userType === "tenant") {
      newUser = await Tenant.create({ username, email, password: hashedPassword, phone });
    } else if (userType === "landlord") {
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required for landlords." });
      }
      newUser = await Landlord.create({ username, email, password: hashedPassword, phone });
    } else {
      return res.status(400).json({ message: "Invalid user type. Must be 'tenant' or 'landlord'." });
    }

    console.log("✅ User Created Successfully:", newUser);

    await sendingMail(
      email,
      "Welcome to RentEase!",
      `Hello ${username},\n\nCongratulations! 🎉 Your account has been successfully created on RentEase.\n\nStart exploring rental properties or listing your own with ease.\n\n- The RentEase Team`
    );

    res.status(201).json({ message: `${userType} registered successfully.`, data: newUser });
  } catch (error) {
    console.error("🔥 Signup Error:", error);
    res.status(500).json({ message: "Error creating user.", error: error.message });
  }
};

// -------------> Get All Users (Both Tenants and Landlords)
const getAllUsers = async (req, res) => {
  try {
    const tenants = await Tenant.find();
    const landlords = await Landlord.find();

    res.status(200).json({
      message: "Users retrieved successfully.",
      tenants,
      landlords,
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving users.", error: error.message });
  }
};

//--------------> Delete User by ID (For Both Tenants and Landlords)
const deleteUser = async (req, res) => {
  try {
    let deletedUser = await Tenant.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      deletedUser = await Landlord.findByIdAndDelete(req.params.id);
    }

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User deleted successfully.", data: deletedUser });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user.", error: error.message });
  }
};

//-------------> Get User by ID
const getUserById = async (req, res) => {
  try {
    let user = await Tenant.findById(req.params.id);
    let userType = "Tenant";

    if (!user) {
      user = await Landlord.findById(req.params.id);
      userType = "Landlord";
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: `${userType} retrieved successfully.`, data: user });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving user.", error: error.message });
  }
};

//-------------> Get User Profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from JWT token
    const userType = req.user.userType; // Get user type from JWT token

    let user;
    if (userType === "Tenant") {
      user = await Tenant.findById(userId).select("-password"); // Exclude password
    } else if (userType === "Landlord") {
      user = await Landlord.findById(userId).select("-password"); // Exclude password
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      message: "User profile retrieved successfully",
      userType,
      data: user
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving user profile.", error: error.message });
  }
};

//-------------> Update User Profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { username, email, phone } = req.body;

    let user;
    if (userType === "Tenant") {
      user = await Tenant.findById(userId);
    } else if (userType === "Landlord") {
      user = await Landlord.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Update fields if provided
    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    await user.save();

    res.status(200).json({
      message: "User profile updated successfully",
      userType,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone || null
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating user profile.", error: error.message });
  }
};

//-------------> Update Password
const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { currentPassword, newPassword } = req.body;

    let user;
    if (userType === "Tenant") {
      user = await Tenant.findById(userId);
    } else if (userType === "Landlord") {
      user = await Landlord.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating password.", error: error.message });
  }
};

//-------------> Update Avatar
const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const avatarPath = req.file.path;

    let user;
    if (userType === "Tenant") {
      user = await Tenant.findById(userId);
    } else if (userType === "Landlord") {
      user = await Landlord.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.avatar = avatarPath;
    await user.save();

    res.status(200).json({
      message: "Avatar updated successfully",
      data: {
        avatar: avatarPath
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating avatar.", error: error.message });
  }
};

//-------------> Reset Password Request
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user in both Tenant and Landlord collections
    let user = await Tenant.findOne({ email });
    let userType = "Tenant";

    if (!user) {
      user = await Landlord.findOne({ email });
      userType = "Landlord";
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await mailutil.sendingMail(
      email,
      "Password Reset Request",
      `Hello ${user.username},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\n- The RentEase Team`
    );

    res.status(200).json({ message: "Password reset email sent." });
  } catch (error) {
    res.status(500).json({ message: "Error requesting password reset.", error: error.message });
  }
};

//-------------> Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Find user with valid reset token
    let user = await Tenant.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    let userType = "Tenant";

    if (!user) {
      user = await Landlord.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });
      userType = "Landlord";
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password.", error: error.message });
  }
};

//----sAVED poperties---//

const saveProperty = async (req, res) => {
  try{
    const propertyId = req.params.propertyId;
    const tenantId= req.user.id;

    //lets chevck if tenant exist

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found." });
    }

    //lets chek if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    // Check if property is already saved
    if (tenant.savedProperties.includes(propertyId)) {
      return res.status(400).json({ message: "Property already saved." });
    }

    //add property to saved propwreties
    tenant.savedProperties.push(propertyId);
    await tenant.save();

    res.status(200).json({
      message:"proeprty saved successfully",
      savedProperty: property,
    });
  }catch(error){
    console.error("Error saving property:", error);
    res.status(500).json({ message: "Error saving property.", error: error.message });
  }
};




module.exports = {
  login,
  signup,
  getAllUsers,
  deleteUser,
  getUserById,
  getUserProfile,
  updateUserProfile,
  updatePassword,
  updateAvatar,
  upload,
  requestPasswordReset,
  resetPassword,
  saveProperty,
};