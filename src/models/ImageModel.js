const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    imageUrl: {
      type: [String], // Path where the image is stored
      required: true,
    },

    // price: {
    //   type: Number,
    //   required: true,
    // },
    

    longitude: {
      type: Number,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    propertyType: {
      type: String,
      enum: ["Apartment", "House", "Villa", "Studio", "Commercial"],
      required: true,
    },
    availabilityStatus: {
      type: String,
      enum: ["Available", "Rented", "Under Maintenance"],
      default: "Available",
    },
  },
  { timestamps: true }
);

const Image = mongoose.model("Image", imageSchema);
module.exports = Image;
