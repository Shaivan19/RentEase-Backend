const express = require("express");
const routes = express.Router();

const propertyController = require("../controllers/PropertyController");
const { verifyToken, isTenant } = require("../middleware/authMiddleware");

routes.post("/addproperties", propertyController.upload.array("images", 5), propertyController.createProperty);
routes.get("/properties", propertyController.getAllProperties);
routes.get("/properties/:id", propertyController.getPropertyById);
routes.delete("/properties/:id", propertyController.deleteProperty);
routes.get("/properties/landlord/:landlordId", propertyController.getPropertiesByLandlord);
routes.put("/properties/:id", propertyController.upload.array("images", 5), propertyController.updateProperty);

// Saved property routes
routes.post("/property/save/:propertyId", verifyToken, isTenant, propertyController.saveProperty);
routes.delete("/property/unsave/:propertyId", verifyToken, isTenant, propertyController.unsaveProperty);
routes.get("/property/saved", verifyToken, isTenant, propertyController.getSavedProperties);

// Property status update route
routes.put("/properties/:propertyId/status", verifyToken, propertyController.updatePropertyStatus);

module.exports = routes;
