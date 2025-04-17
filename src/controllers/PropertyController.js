const Property = require("../models/PropertyModel");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const cloudinaryUtil = require("../utils/CloudinaryUtil");
const mailutil = require("../utils/MailUtil");
const Landlord = require("../models/LandlordModel");



// Create new property
// const createProperty = async (req, res) => {
//   try {
//     const property = new Property(req.body);
//     await property.save();
//     res.status(201).json(property);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };


// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save files temporarily in "uploads" folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});

// Multer upload middleware
const upload = multer({ storage: storage });

const createProperty = async (req, res) => {
  try {
    console.log("\n=== Property Creation Request ===");
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log("Request Files:", req.files ? req.files.map(f => f.filename) : 'No files');
    
    const { 
      title, 
      description, 
      price, 
      location, 
      owner, 
      propertyType, 
      bedrooms, 
      bathrooms, 
      availableFrom,
      address,
      furnished,
      amenities,
      constructionYear
    } = req.body;  // Remove area from destructuring since we'll parse it from landArea

    // Parse landArea
    let parsedLandArea = null;
    if (req.body.landArea) {
      try {
        parsedLandArea = JSON.parse(req.body.landArea);
      } catch (e) {
        console.error('Error parsing landArea:', e);
        return res.status(400).json({ error: "Invalid landArea format" });
      }
    }

    // Parse nearbyFacilities
    let parsedNearbyFacilities = [];
    if (req.body.nearbyFacilities) {
      try {
        parsedNearbyFacilities = JSON.parse(req.body.nearbyFacilities);
      } catch (e) {
        console.error('Error parsing nearbyFacilities:', e);
      }
    }

    console.log("\n=== Parsed Fields ===");
    console.log("Title:", title);
    console.log("Description:", description);
    console.log("Price:", price);
    console.log("Location:", location);
    console.log("Owner:", owner);
    console.log("Property Type:", propertyType);
    console.log("Bedrooms:", bedrooms);
    console.log("Bathrooms:", bathrooms);
    console.log("Available From:", availableFrom);
    console.log("Address:", address);
    console.log("Furnished:", furnished);
    console.log("Amenities:", amenities);
    console.log("Area:", parsedLandArea ? Number(parsedLandArea.value) : null);  // Update the log to use parsedLandArea

    // Check for missing required fields
    const missingFields = {
      title: !title,
      description: !description,
      price: !price,
      location: !location,
      owner: !owner,
      propertyType: !propertyType,
      bedrooms: bedrooms == null,
      bathrooms: bathrooms == null,
      availableFrom: !availableFrom,
      address: !address,
      area: !parsedLandArea,  // Update to use parsedLandArea
      nearbyFacilities: !parsedNearbyFacilities,
      constructionYear: !constructionYear
    };

    console.log("\n=== Missing Fields Check ===");
    console.log(JSON.stringify(missingFields, null, 2));

    if (!title || !description || !price || !location || !owner || !propertyType || 
        bedrooms == null || bathrooms == null || !availableFrom || !address || !parsedLandArea) {
      return res.status(400).json({ 
        error: "Missing required fields",
        missingFields: Object.entries(missingFields)
          .filter(([_, isMissing]) => isMissing)
          .map(([field]) => field)
      });
    }

    // Validate address fields
    const missingAddressFields = {
      street: !address.street,
      city: !address.city,
      state: !address.state,
      zipCode: !address.zipCode,
      country: !address.country
    };

    console.log("\n=== Missing Address Fields Check ===");
    console.log(JSON.stringify(missingAddressFields, null, 2));

    if (!address.street || !address.city || !address.state || !address.zipCode || !address.country) {
      return res.status(400).json({ 
        error: "Missing required address fields",
        missingFields: Object.entries(missingAddressFields)
          .filter(([_, isMissing]) => isMissing)
          .map(([field]) => field)
      });
    }

    // Validate owner ID format
    if (!mongoose.Types.ObjectId.isValid(owner)) {
      return res.status(400).json({ error: "Invalid owner ID" });
    }

    // Get landlord details for email
    const landlord = await Landlord.findById(owner);
    if (!landlord) {
      return res.status(404).json({ error: "Landlord not found" });
    }

    // Handle image uploads to Cloudinary
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        // Upload each image to Cloudinary
        for (const file of req.files) {
          const cloudinaryResponse = await cloudinaryUtil.uploadFileToCloudinary(file);
          imageUrls.push(cloudinaryResponse.secure_url);
        }
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
        return res.status(500).json({ error: "Error uploading images to cloud storage" });
      }
    }

    // Create property with all parsed data
    const property = new Property({
      title,
      description,
      price: Number(price),
      location,
      owner,
      propertyType,
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      furnished: furnished === 'true',
      availableFrom,
      address,
      amenities: amenities ? amenities.split(',') : [],
      images: imageUrls,
      area: parsedLandArea ? Number(parsedLandArea.value) : null,
      landArea: parsedLandArea, // Include the full landArea object
      nearbyFacilities: parsedNearbyFacilities,
      constructionYear: Number(constructionYear)
    });

    await property.save();

    // Update the email template to include area
    const emailSubject = "Property Listed Successfully!";
    const emailBody = `
      Dear ${landlord.username},

      Congratulations! Your property "${title}" has been successfully listed on RentEase.

      Property Details:
      - Title: ${title}
      - Location: ${location}
      - Price: ₹${price}
      - Type: ${propertyType}
      - Area: ${parsedLandArea ? Number(parsedLandArea.value) : null} sq ft
      - Bedrooms: ${bedrooms}
      - Bathrooms: ${bathrooms}
      - Available From: ${new Date(availableFrom).toLocaleDateString()}
      - Address: ${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}

      You can manage your property listing from your dashboard.

      Best regards,
      The RentEase Team
    `;

    try {
      await mailutil.sendingMail(landlord.email, emailSubject, emailBody);
      console.log("✅ Property creation confirmation email sent successfully");
    } catch (emailError) {
      console.error("🔥 Error sending property creation email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json(property);
  } catch (error) {
    console.error("Property Creation Error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Get all properties
const getAllProperties = async (req, res) => {
  try {
    const properties = await Property.find();
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single property by ID
const getPropertyById = async (req, res) => {
  try {
    console.log("Fetching property with ID:", req.params.id);
    
    const property = await Property.findById(req.params.id)
      .populate({
        path: 'owner',
        model: 'Landlord',  // Keep it as User
        select: 'username email phone' // Include role if needed
      });

    if (!property) {
      console.log("Property not found");
      return res.status(404).json({ message: "Property not found" });
    }

    // Log the populated property for debugging
    console.log("Found property with owner details:", {
      id: property._id,
      owner: property.owner ? {
        username: property.owner.username,
        email: property.owner.email,
        phone: property.owner.phone
      } : null
    });

    res.status(200).json(property);
  } catch (error) {
    console.error("Error in getPropertyById:", error);
    res.status(500).json({ 
      error: "Error fetching property details",
      details: error.message 
    });
  }
};

// Delete property by ID
const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    res.status(200).json({ message: "Property deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get properties by landlord ID
const getPropertiesByLandlord = async (req, res) => {
  try {
    const landlordId = req.params.landlordId;
    
    // Validate landlord ID format
    if (!mongoose.Types.ObjectId.isValid(landlordId)) {
      return res.status(400).json({ error: "Invalid landlord ID" });
    }

    // Find all properties where owner matches the landlord ID
    const properties = await Property.find({ owner: landlordId })
      .sort({ createdAt: -1 }); // Sort by newest first

    if (!properties || properties.length === 0) {
      return res.status(200).json([]); // Return empty array if no properties found
    }

    res.status(200).json(properties);
  } catch (error) {
    console.error("Error fetching landlord properties:", error);
    res.status(500).json({ error: error.message });
  }
};


const updateProperty = async (req, res) => {
  try {
    console.log("\n=== Property Update Request ===");
    console.log("Property ID:", req.params.id);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));
    console.log("Request Files:", req.files ? req.files.map(f => f.filename) : 'No files');

    const propertyId = req.params.id;
    
    // Check if property exists
    const existingProperty = await Property.findById(propertyId);
    if (!existingProperty) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Handle new image uploads to Cloudinary
    let imageUrls = [...existingProperty.images]; // Keep existing images
    if (req.files && req.files.length > 0) {
      try {
        // Upload each new image to Cloudinary
        for (const file of req.files) {
          const cloudinaryResponse = await cloudinaryUtil.uploadFileToCloudinary(file);
          imageUrls.push(cloudinaryResponse.secure_url);
        }
      } catch (uploadError) {
        console.error("Cloudinary Upload Error:", uploadError);
        return res.status(500).json({ error: "Error uploading images to cloud storage" });
      }
    }

    // Parse landArea for update
    let parsedLandArea = existingProperty.landArea;
    if (req.body.landArea) {
      try {
        parsedLandArea = JSON.parse(req.body.landArea);
      } catch (e) {
        console.error('Error parsing landArea during update:', e);
        return res.status(400).json({ error: "Invalid landArea format" });
      }
    }

    // Parse nearbyFacilities for update
    let parsedNearbyFacilities = existingProperty.nearbyFacilities;
    if (req.body.nearbyFacilities) {
      try {
        parsedNearbyFacilities = JSON.parse(req.body.nearbyFacilities);
      } catch (e) {
        console.error('Error parsing nearbyFacilities during update:', e);
      }
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      images: imageUrls,
      furnished: req.body.furnished === 'true',
      amenities: req.body.amenities ? req.body.amenities.split(',') : existingProperty.amenities,
      area: parsedLandArea ? Number(parsedLandArea.value) : existingProperty.area,
      landArea: parsedLandArea,
      nearbyFacilities: parsedNearbyFacilities,
      constructionYear: req.body.constructionYear ? Number(req.body.constructionYear) : existingProperty.constructionYear
    };

    // Update property
    const updatedProperty = await Property.findByIdAndUpdate(
      propertyId,
      updateData,
      { new: true, runValidators: true }
    );

    // Send update confirmation email to landlord
    const landlord = await Landlord.findById(existingProperty.owner);
    if (landlord) {
      const emailSubject = "Property Updated Successfully!";
      const emailBody = `
        Dear ${landlord.username},

        Your property "${updatedProperty.title}" has been successfully updated on RentEase.

        Updated Property Details:
        - Title: ${updatedProperty.title}
        - Location: ${updatedProperty.location}
        - Price: ₹${updatedProperty.price}
        - Type: ${updatedProperty.propertyType}
        - Area: ${parsedLandArea ? Number(parsedLandArea.value) : updatedProperty.area} sq ft
        - Bedrooms: ${updatedProperty.bedrooms}
        - Bathrooms: ${updatedProperty.bathrooms}
        - Available From: ${new Date(updatedProperty.availableFrom).toLocaleDateString()}
        - Address: ${updatedProperty.address.street}, ${updatedProperty.address.city}, ${updatedProperty.address.state} ${updatedProperty.address.zipCode}, ${updatedProperty.address.country}

        You can view the updated listing from your dashboard.

        Best regards,
        The RentEase Team
      `;

      try {
        await mailutil.sendingMail(landlord.email, emailSubject, emailBody);
        console.log("✅ Property update confirmation email sent successfully");
      } catch (emailError) {
        console.error("🔥 Error sending property update email:", emailError);
        // Don't fail the request if email fails
      }
    }

    res.status(200).json(updatedProperty);
  } catch (error) {
    console.error("Property Update Error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Save a property
const saveProperty = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const tenantId = req.user.id;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if property is already saved
    if (property.savedBy.includes(tenantId)) {
      return res.status(400).json({ message: "Property already saved" });
    }

    // Add tenant to savedBy array
    property.savedBy.push(tenantId);
    await property.save();

    res.status(200).json({
      message: "Property saved successfully",
      property: {
        id: property._id,
        title: property.title,
        location: property.location,
        price: property.price,
        images: property.images
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error saving property", error: error.message });
  }
};

// Unsave a property
const unsaveProperty = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const tenantId = req.user.id;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if property is saved by user
    if (!property.savedBy.includes(tenantId)) {
      return res.status(400).json({ message: "Property not saved by user" });
    }

    // Remove tenant from savedBy array
    property.savedBy = property.savedBy.filter(id => id.toString() !== tenantId);
    await property.save();

    res.status(200).json({
      message: "Property unsaved successfully",
      property: {
        id: property._id,
        title: property.title
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error unsaving property", error: error.message });
  }
};

// Get saved properties
const getSavedProperties = async (req, res) => {
  try {
    const tenantId = req.user.id;

    // Find all properties saved by the tenant
    const savedProperties = await Property.find({ savedBy: tenantId })
      .populate('owner', 'username email phone')
      .select('title description price location images address propertyType bedrooms bathrooms furnished availableFrom amenities');

    res.status(200).json({
      message: "Saved properties retrieved successfully",
      properties: savedProperties.map(property => ({
        id: property._id,
        title: property.title,
        description: property.description,
        price: property.price,
        location: property.location,
        images: property.images,
        address: property.address,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        furnished: property.furnished,
        availableFrom: property.availableFrom,
        amenities: property.amenities,
        landlord: {
          id: property.owner._id,
          name: property.owner.username,
          email: property.owner.email,
          phone: property.owner.phone
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving saved properties", error: error.message });
  }
};

// Update property status (for landlords)
const updatePropertyStatus = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;

        // Find the property
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        // Check if the user is the owner of the property
        if (property.owner.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the property owner can update the status'
            });
        }

        // Validate the new status
        if (!['Available', 'Occupied', 'Maintenance', 'Reserved'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: Available, Occupied, Maintenance, Reserved'
            });
        }

        // Update the property status
        property.status = status;
        await property.save();

        res.status(200).json({
            success: true,
            message: 'Property status updated successfully',
            property
        });
    } catch (error) {
        console.error('Error updating property status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating property status'
        });
    }
};

module.exports = { 
  createProperty, 
  getAllProperties, 
  getPropertyById, 
  deleteProperty, 
  upload,
  getPropertiesByLandlord,
  updateProperty,
  saveProperty,
  unsaveProperty,
  getSavedProperties,
  updatePropertyStatus
}

