const express = require("express");

const {
  register,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword,
  resendOtp,
  getProfile,
  updateProfile
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile/:id", protect, getProfile);
router.put("/profile/:id", protect, updateProfile);

module.exports = router;
