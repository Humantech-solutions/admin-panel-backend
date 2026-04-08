const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailUtil');

const SECRET = process.env.JWT_SECRET || "mysecretkey";
const MFA_SECRET = process.env.MFA_JWT_SECRET || "mfatempsecretkey";

// REGISTER
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword
    });

    await newUser.save();

    res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// LOGIN (Step 1 of MFA)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    // Generate temporary token for MFA step
    console.log("Generating temp MFA token for email:", user.email);
    const mfaToken = jwt.sign({ id: user._id, email: user.email }, MFA_SECRET, { expiresIn: '15m' });

    if (!user.mfaEnabled) {
      console.log("MFA setup required for user. Generating secret...");
      // 1st login -> Setup MFA
      const secret = otplib.generateSecret();
      const service = "Nabhira Admin";
      // Manually construct URI to avoid otplib internal crash
      const otpauth = `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(service)}`;
      
      console.log("Generating QR code...");
      const qrCodeUrl = await qrcode.toDataURL(otpauth, {
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 300
      });
      
      console.log("Saving MFA secret to user model...");
      user.mfaSecret = secret;
      await user.save();

      console.log("Sending QR code email to:", user.email);
      // Email the QR code
      const emailResult = await sendEmail({
        to: user.email,
        subject: "Action Required: Setup Two-Factor Authentication (OTP)",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 16px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.05); color: #11253e;">
            <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Secure Your Account</h1>
            <p style="color: #64748b; font-size: 16px; margin-bottom: 32px;">Please set up your two-factor authentication to continue to the dashboard.</p>
            
            <div style="background: #f8fafc; padding: 32px; border-radius: 12px; margin-bottom: 32px;">
              <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #11253e; margin-bottom: 16px;">Option 1: Scan QR Code</h2>
              <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px; border-radius: 12px; border: 8px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
              <p style="color: #64748b; font-size: 14px; margin-top: 16px;">Open Google Authenticator and scan this code.</p>
            </div>

            <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
              <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #11253e; margin-bottom: 12px;">Option 2: Manual Setup</h2>
              <div style="font-family: monospace; font-size: 20px; font-weight: 700; color: #f99d1c; padding: 12px; background: white; border: 1px dashed #cbd5e1; border-radius: 8px; display: inline-block; letter-spacing: 4px;">
                ${secret}
              </div>
              <p style="color: #64748b; font-size: 14px; margin-top: 12px;">If you cannot scan, use this account key manually.</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0;" />
            <p style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em;">Nabhira Technologies Admin Security Layer</p>
          </div>
        `,
        attachments: [
          {
            filename: 'qrcode.png',
            content: qrCodeUrl.split('base64,')[1],
            encoding: 'base64',
            cid: 'qrcode'
          }
        ]
      });
      console.log("Email result:", emailResult);


      return res.json({
        success: true,
        mfaSetupRequired: true,
        message: "MFA Setup Required. Check your email for the QR code.",
        mfaToken
      });
    }

    console.log("MFA already enabled for user. Requesting OTP...");
    // Subsequent logins -> Just ask for OTP
    res.json({
      success: true,
      mfaRequired: true,
      message: "Please enter your 6-digit Authenticator code.",
      mfaToken
    });
  } catch (error) {
    console.error("Login controller CRASH:", error);
    res.status(500).json({ success: false, message: "Server error during login", details: error.message });
  }
};

// VERIFY MFA (Step 2 of MFA)
exports.verifyMfa = async (req, res) => {
  try {
    const { mfaToken, otp } = req.body;

    if (!mfaToken || !otp) {
      return res.status(400).json({ success: false, message: "Token and OTP are required" });
    }

    // Decode temp token
    const decoded = jwt.verify(mfaToken, MFA_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    // Verify OTP
    const isValid = otplib.verify({ token: otp, secret: user.mfaSecret });
    
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid Authenticator code" });
    }

    // Mark MFA active if not already
    if (!user.mfaEnabled) {
      user.mfaEnabled = true;
      await user.save();
    }

    // Generate real access token
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET, { expiresIn: "24h" });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        email: user.email
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: "Login session expired. Please log in again." });
    }
    console.error("MFA Verify error:", error);
    res.status(500).json({ success: false, message: "Server error during verification", details: error.message });
  }
};