const cloudinary = require("cloudinary").v2;
require('dotenv').config();
 
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
 
 // Upload Image to Cloudinary
 const uploadFileToCloudinary = async (file) => {
   try {
     const result = await cloudinary.uploader.upload(file.path, {
       folder: "rentease-images",
     });
     return result;
   } catch (error) {
     throw new Error("Cloudinary upload failed: " + error.message);
   }
 };
 
 module.exports = { uploadFileToCloudinary };