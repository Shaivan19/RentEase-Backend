// // console.log("Hello")
// // var user =require("./user")
// // console.log(user)
// // console.log(user.userName)
// // console.log(user.userAge)

// // user.printUserData(100)

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


app.use("/api", roleRoutes); //  Add API prefix
app.use(userRoutes);
app.use( propertyRoutes); 
app.use(visitpropertyRoutes);
app.use(imageRoutes);
app.use(bookpropertyRoutes);

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
   