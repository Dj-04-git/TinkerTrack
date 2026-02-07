const db = require("../../db/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { config } = require("../../config/config.js");

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
exports.register = async (req, res) => {
  const { name, email, password, phone, location, about } = req.body;
  
  // Validate phone number (10 digits only)
  if (!phone || phone.toString().length !== 10 || isNaN(phone)) {
    return res.status(400).json({ error: "Phone number must be exactly 10 digits" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  db.run(
    "INSERT INTO users (name, email, password, phone, location, about) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, hashedPassword, phone, location, about],
    function (err) {
      if (err) return res.status(400).json({ error: "User already exists" });

      // Store OTP in otp_verification table (expires in 10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.run(
        "INSERT OR REPLACE INTO otp_verification (email, otp, expiresAt) VALUES (?, ?, ?)",
        [email, otp, expiresAt],
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Error sending OTP" });
          }

          initializeTransporter().sendMail({
            to: email,
            subject: "OTP Verification",
            text: `Your OTP is ${otp}`
          });

          res.json({ message: "Registered successfully. Verify OTP." });
        }
      );
    }
  );
};

// VERIFY OTP
exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  db.get(
    "SELECT * FROM otp_verification WHERE email=? AND otp=? AND expiresAt > datetime('now')",
    [email, otp],
    (err, otpRecord) => {
      if (!otpRecord) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      db.run(
        "UPDATE users SET isVerified=1 WHERE email=?",
        [email],
        (err) => {
          if (err) {
            return res.status(400).json({ error: "Verification failed" });
          }

          // Delete OTP after successful verification
          db.run("DELETE FROM otp_verification WHERE email=?", [email]);

          res.json({ message: "Account verified successfully" });
        }
      );
    }
  );
};

// RESEND OTP
exports.resendOtp = (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.run(
    "INSERT OR REPLACE INTO otp_verification (email, otp, expiresAt) VALUES (?, ?, ?)",
    [email, otp, expiresAt],
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
exports.login = (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email=?", [email], async (err, user) => {
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.isVerified) return res.status(403).json({ error: "Verify OTP first" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token, userId: user.id });
  });
};

// FORGOT PASSWORD (SEND OTP)
exports.forgotPassword = (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.run(
    "INSERT OR REPLACE INTO otp_verification (email, otp, expiresAt) VALUES (?, ?, ?)",
    [email, otp, expiresAt],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Error processing request" });
      }

      initializeTransporter().sendMail({
        to: email,
        subject: "Reset Password OTP",
        text: `Your OTP is ${otp}`
      });

      res.json({ message: "OTP sent to email" });
    }
  );
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const hashed = await bcrypt.hash(newPassword, 10);

  db.get(
    "SELECT * FROM otp_verification WHERE email=? AND otp=? AND expiresAt > datetime('now')",
    [email, otp],
    (err, otpRecord) => {
      if (!otpRecord) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      db.run(
        "UPDATE users SET password=? WHERE email=?",
        [hashed, email],
        (err) => {
          if (err) {
            return res.status(400).json({ error: "Password reset failed" });
          }

          // Delete OTP after successful reset
          db.run("DELETE FROM otp_verification WHERE email=?", [email]);

          res.json({ message: "Password reset successful" });
        }
      );
    }
  );
};

// GET PROFILE
exports.getProfile = (req, res) => {
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
exports.updateProfile = (req, res) => {
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

