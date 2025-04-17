// // console.log("Hello")
// // var user =require("./user")
// // console.log(user)
// // console.log(user.userName)
// // console.log(user.userAge)

// // user.printUserData(100)
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors= require("cors");

const app = express();

// Middleware
app.use(express.json()); //  Allow JSON parsing
app.use(cors())
app.use(express.urlencoded({ extended: true })); //  Allow URL Encoded data
// Routes
const roleRoutes = require("./src/routes/RoleRoutes");
const userRoutes = require("./src/routes/UserRoutes");
const propertyRoutes = require("./src/routes/PropertyRoutes");
const visitpropertyRoutes = require("./src/routes/VisitpropertyRoutes");
const imageRoutes = require("./src/routes/ImageRoutes");
const bookpropertyRoutes = require("./src/routes/BookpropertyRoutes");

const applicationRoutes = require("./src/routes/ApplicationRoutes");
const leaseRoutes = require("./src/routes/LeaseRoutes");
const maintenanceRoutes = require("./src/routes/MaintenanceRoutes");
const paymentRoutes = require("./src/routes/PaymentRoutes");
const notificationRoutes = require("./src/routes/NotificationRoutes");
const reviewRoutes = require("./src/routes/ReviewRoutes");

const adminRoutes = require("./src/routes/AdminRoutes");


app.use("/api", roleRoutes); //  Add API prefix
app.use(userRoutes);
app.use( propertyRoutes); 
app.use(visitpropertyRoutes);
app.use(imageRoutes);
app.use(bookpropertyRoutes);
app.use(applicationRoutes);
app.use(leaseRoutes);
app.use(maintenanceRoutes);
app.use(paymentRoutes);
app.use(notificationRoutes);
app.use(reviewRoutes);


app.use("/admin", adminRoutes);

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/SAMPLE_PROJECT")
    .then(() => {
        console.log("Database connected...");

        
// MongoDB Connection & Server Start
const PORT = 1909;
        // Start server only after DB is connected 
        app.listen(PORT, () => {
            console.log("Server started on port:", PORT);
        });
    })
    .catch((error) => {
        console.error("Database connection error:", error);
    });
   