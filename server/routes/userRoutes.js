const express = require("express");
const router = express.Router();
const controller = require("../controllers/userController");
const { validateIdParam } = require("../middleware/validationMiddleware");

// Get all users
router.get("/", controller.getUsers);

// Get user stats
router.get("/stats", controller.getUserStats);

// Get user by ID
router.get("/:userId", validateIdParam('userId'), controller.getUserById);

// Update user
router.put("/:userId", validateIdParam('userId'), controller.updateUser);

// Delete user
router.delete("/:userId", validateIdParam('userId'), controller.deleteUser);

module.exports = router;
