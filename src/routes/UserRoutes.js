const routes = require("express").Router()
const userController = require("../controllers/UserController")
const { verifyToken, isLandlord, isTenant } = require("../middleware/authMiddleware")
// const Property = require("../models/Property")
// const VisitProperty = require("../models/VisitProperty")
// const BookProperty = require("../models/BookProperty")
const dashboardController = require("../controllers/DashboardController")

// Public routes
routes.post("/users/login", userController.login)
routes.post("/users/signup", userController.signup)
routes.post("/users/reset-password-request", userController.requestPasswordReset)
routes.post("/users/reset-password", userController.resetPassword)

// Protected routes
routes.get("/users", verifyToken, userController.getAllUsers)
routes.delete("/users/:id", verifyToken, userController.deleteUser)
routes.get("/users/:id", verifyToken, userController.getUserById)

// User Profile routes
routes.get("/profile", verifyToken, userController.getUserProfile)
routes.put("/profile", verifyToken, userController.updateUserProfile)
routes.put("/profile/password", verifyToken, userController.updatePassword)
routes.post("/profile/avatar", verifyToken, userController.upload.single('avatar'), userController.updateAvatar)

// Role-specific routes
routes.get("/landlord/dashboard", verifyToken, isLandlord, dashboardController.getLandlordDashboard)
routes.get("/tenant/dashboard", verifyToken, isTenant, dashboardController.getTenantDashboard)

routes.post("/tenant/save-property/:propertyId", verifyToken, isTenant, userController.saveProperty)

module.exports = routes