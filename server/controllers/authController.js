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

// Validation helpers
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validatePassword = (password) => {
  const errors = [];
  if (!password || password.length < 9) {
    errors.push("Password must be at least 9 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  return errors;
};

const validateEmail = (email) => {
  if (!email || !emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return null;
};

// REGISTER
exports.register = async (req, res) => {
  const { name, email, password, phone, location, about } = req.body;

  // Validate required fields
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  // Validate email format
  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  // Validate password
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ error: passwordErrors.join(". ") });
  }

  // Validate phone number (10 digits only)
  if (!phone || phone.toString().length !== 10 || isNaN(phone)) {
    return res.status(400).json({ error: "Phone number must be exactly 10 digits" });
  }

  // Check if email already exists
  db.get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    db.run(
      "INSERT INTO users (name, email, password, phone, location, about) VALUES (?, ?, ?, ?, ?, ?)",
      [name.trim(), email.toLowerCase().trim(), hashedPassword, phone, location, about],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "Failed to create account. Please try again." });
        }

        // Store OTP in otp_verification table (expires in 10 minutes)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        db.run(
          "INSERT OR REPLACE INTO otp_verification (email, otp, expiresAt) VALUES (?, ?, ?)",
          [email.toLowerCase().trim(), otp, expiresAt],
          async (err) => {
            if (err) {
              return res.status(500).json({ error: "Error generating OTP" });
            }

            try {
              await initializeTransporter().sendMail({
                to: email,
                subject: "TinkerTrack - Verify Your Email",
                text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                    <h2 style="color: #333;">Verify Your Email</h2>
                    <p>Welcome to TinkerTrack! Use the code below to verify your email address:</p>
                    <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                  </div>
                `
              });
              res.json({ message: "Registered successfully. Please check your email for the verification code." });
            } catch (emailError) {
              console.error("Failed to send OTP email:", emailError);
              // Still succeed but warn about email
              res.json({ message: "Registered successfully. OTP: " + otp + " (Email service unavailable)" });
            }
          }
        );
      }
    );
  });
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

  // Validate email
  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  // Check if user exists
  db.get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (!user) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.run(
      "INSERT OR REPLACE INTO otp_verification (email, otp, expiresAt) VALUES (?, ?, ?)",
      [email.toLowerCase().trim(), otp, expiresAt],
      async function (err) {
        if (err) {
          return res.status(500).json({ error: "Error generating OTP" });
        }

        try {
          await initializeTransporter().sendMail({
            to: email,
            subject: "TinkerTrack - Verification Code",
            text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #333;">Verification Code</h2>
                <p>You requested a new verification code. Use the code below:</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
                </div>
                <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
              </div>
            `
          });
          res.json({ message: "OTP sent successfully. Please check your email." });
        } catch (emailError) {
          console.error("Failed to send OTP email:", emailError);
          res.json({ message: "OTP: " + otp + " (Email service unavailable)" });
        }
      }
    );
  });
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

  // Validate email
  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  // Check if user exists
  db.get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: "If an account exists with this email, you will receive a reset code." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.run(
      "INSERT OR REPLACE INTO otp_verification (email, otp, expiresAt) VALUES (?, ?, ?)",
      [email.toLowerCase().trim(), otp, expiresAt],
      async (err) => {
        if (err) {
          return res.status(500).json({ error: "Error processing request" });
        }

        try {
          await initializeTransporter().sendMail({
            to: email,
            subject: "TinkerTrack - Reset Your Password",
            text: `Your password reset code is: ${otp}\n\nThis code will expire in 10 minutes.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #333;">Reset Your Password</h2>
                <p>You requested to reset your password. Use the code below:</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
                </div>
                <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
              </div>
            `
          });
          res.json({ message: "If an account exists with this email, you will receive a reset code." });
        } catch (emailError) {
          console.error("Failed to send password reset email:", emailError);
          res.json({ message: "OTP: " + otp + " (Email service unavailable)" });
        }
      }
    );
  });
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  // Validate email
  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  // Validate OTP
  if (!otp || otp.length !== 6) {
    return res.status(400).json({ error: "Please enter a valid 6-digit OTP" });
  }

  // Validate new password
  const passwordErrors = validatePassword(newPassword);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ error: passwordErrors.join(". ") });
  }

  db.get(
    "SELECT * FROM otp_verification WHERE email=? AND otp=? AND expiresAt > datetime('now')",
    [email.toLowerCase().trim(), otp],
    async (err, otpRecord) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      if (!otpRecord) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      db.run(
        "UPDATE users SET password=? WHERE email=?",
        [hashed, email.toLowerCase().trim()],
        (err) => {
          if (err) {
            return res.status(400).json({ error: "Password reset failed" });
          }

          // Delete OTP after successful reset
          db.run("DELETE FROM otp_verification WHERE email=?", [email.toLowerCase().trim()]);

          res.json({ message: "Password reset successful. You can now login with your new password." });
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

