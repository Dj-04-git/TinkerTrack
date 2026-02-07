import express from "express";
import {
  register,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword,
  resendOtp,
  getProfile,
  updateProfile
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile/:id", protect, getProfile);
router.put("/profile/:id", protect, updateProfile);

export default router;
