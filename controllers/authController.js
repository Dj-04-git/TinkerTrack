import db from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter;

// Initialize transporter after config is loaded
const initializeTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.EMAIL,
        pass: config.EMAIL_PASS
      }
    });
  }
  return transporter;
};

// REGISTER
export const register = async (req, res) => {
  const { name, email, password, phone, location, about } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  db.run(
    "INSERT INTO users (name, email, password, otp, phone, location, about) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, email, hashedPassword, otp, phone , location , about ],
    function (err) {
      if (err) return res.status(400).json({ error: "User already exists" });

      initializeTransporter().sendMail({
        to: email,
        subject: "OTP Verification",
        text: `Your OTP is ${otp}`
      });

      res.json({ message: "Registered successfully. Verify OTP." });
    }
  );
};

// VERIFY OTP
export const verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  db.get(
    "SELECT * FROM users WHERE email=? AND otp=?",
    [email, otp],
    (err, user) => {
      if (!user) return res.status(400).json({ error: "Invalid OTP" });

      db.run(
        "UPDATE users SET isVerified=1, otp=NULL WHERE email=?",
        [email]
      );

      res.json({ message: "Account verified successfully" });
    }
  );
};

// RESEND OTP
export const resendOtp = (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  db.run(
    "UPDATE users SET otp=? WHERE email=?",
    [otp, email],
    function (err) {
      if (err) return res.status(400).json({ message: "User not found" });

      initializeTransporter().sendMail({
        to: email,
        subject: "OTP Verification",
        text: `Your OTP is ${otp}`
      });

      res.json({ message: "OTP resent successfully" });
    }
  );
};

// LOGIN
export const login = (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email=?", [email], async (err, user) => {
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.isVerified) return res.status(403).json({ error: "Verify OTP first" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign(
  { id: user.id },
  config.JWT_SECRET,
  { expiresIn: "1h" }
);

    res.json({ message: "Login successful", token, userId: user.id });
  });
};

// FORGOT PASSWORD (SEND OTP)
export const forgotPassword = (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  db.run("UPDATE users SET otp=? WHERE email=?", [otp, email], function () {
    initializeTransporter().sendMail({
      to: email,
      subject: "Reset Password OTP",
      text: `Your OTP is ${otp}`
    });

    res.json({ message: "OTP sent to email" });
  });
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const hashed = await bcrypt.hash(newPassword, 10);

  db.get(
    "SELECT * FROM users WHERE email=? AND otp=?",
    [email, otp],
    (err, user) => {
      if (!user) return res.status(400).json({ error: "Invalid OTP" });

      db.run(
        "UPDATE users SET password=?, otp=NULL WHERE email=?",
        [hashed, email]
      );

      res.json({ message: "Password reset successful" });
    }
  );
};

// GET PROFILE
export const getProfile = (req, res) => {
  const { id } = req.params;
  const tokenUserId = req.user.id; // User ID from JWT token

  // Verify user can only access their own profile
  if (parseInt(id) !== tokenUserId) {
    return res.status(403).json({ error: "Unauthorized - Cannot access another user's profile" });
  }

  db.get(
    "SELECT id, name, email, phone, location, about FROM users WHERE id=?",
    [id],
    (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: "User not found" });
      }

      res.json({ user });
    }
  );
};

// UPDATE PROFILE
export const updateProfile = (req, res) => {
  const { id } = req.params;
  const { name, phone, location, about } = req.body;
  const tokenUserId = req.user.id;

  // Verify user can only update their own profile
  if (parseInt(id) !== tokenUserId) {
    return res.status(403).json({ error: "Unauthorized - Cannot update another user's profile" });
  }

  db.run(
    "UPDATE users SET name = ?, phone = ?, location = ?, about = ? WHERE id = ?",
    [name, phone, location, about, id],
    function (err) {
      if (err) {
        console.error('Database error updating profile:', err);
        return res.status(400).json({ error: "Error updating profile: " + err.message });
      }

      // Fetch and return updated profile
      db.get(
        "SELECT id, name, email, phone, location, about FROM users WHERE id=?",
        [id],
        (err, user) => {
          if (err || !user) {
            return res.status(400).json({ error: "User not found" });
          }

          res.json({ message: "Profile updated successfully", user });
        }
      );
    }
  );
};
