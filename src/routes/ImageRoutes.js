const express = require("express");
const router = express.Router();
const ImageController = require("../controllers/ImageController");

// Add Image Without File Upload
router.post("/addimage", ImageController.addImage);

// Upload Image with File (Cloudinary)
router.post("/uploadimage", ImageController.addImageWithFile);

// Get All Images
router.get("/getallimages", ImageController.getAllImages);

module.exports = router;
