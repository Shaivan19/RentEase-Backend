const mongoose = require("mongoose");

const TenantSchema = new mongoose.Schema({
  username: {
      type: String,
      required: true
     },
  email: {
      type: String,
      unique: true,
      required: true 
      },
  password: {
      type: String,
      required: true 
    },
  phone: {
      type: String,
      required: true
  },  
  avatar: {
      type: String,
      default: null
  },
  userType: {
      type: String,
      default: "Tenant"
  },
  savedProperties: [
      {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Property"
      }
  ],
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

module.exports = mongoose.model("Tenant", TenantSchema);