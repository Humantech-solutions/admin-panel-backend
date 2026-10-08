const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailUtil');
const { encrypt } = require('../utils/cryptoUtil');

const SECRET = process.env.JWT_SECRET || "mysecretkey";
const MFA_SECRET = process.env.MFA_JWT_SECRET || "mfatempsecretkey";

const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');

// Helper to resolve unique slug
async function resolveUniqueSlug(base, Model) {
  const slugBase = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  let slug = slugBase;
  let i = 1;
  while (await Model.exists({ slug })) {
    slug = `${slugBase}-${i++}`;
  }
  return slug;
}

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    // Create User without companyId initially (user will set up company after MFA login!)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'company_admin',
      companyId: null,
      mfaEnabled: false,
      mustChangePassword: false,
    });

    await newUser.save();

    res.json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        companyId: null
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error during registration", details: error.message });
  }
};

// LOGIN (Step 1 of MFA)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Incorrect Email ID or Password" });
    }

      
      const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect Email ID or Password" });
    }

    // Generate temporary token for MFA/Password step
    console.log("Generating temp MFA token for email:", user.email);
    const mfaToken = jwt.sign({ id: user._id, email: user.email }, MFA_SECRET, { expiresIn: '15m' });

    if (user.mustChangePassword && !user.mfaEnabled) {
      return res.json({
        success: true,
        passwordChangeRequired: true,
        message: "Please set a new permanent password.",
        mfaToken
      });
    }

    let qrCodeHtml = '';

    if (!user.mfaEnabled) {
      console.log("MFA setup required for user. Generating secret...");
      const secret = otplib.generateSecret();
      const service = "Hutech Admin";
      const otpauth = `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(service)}`;
      
      const qrCodeUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'H', margin: 4, width: 300 });
      user.mfaSecret = secret;
      await user.save();

      return res.json({
        success: true,
        mfaSetupRequired: true,
        message: "Scan the QR code with Google Authenticator to setup MFA.",
        mfaToken,
        qrCodeUrl
      });
    }

    console.log("MFA already enabled for user. Proceeding to MFA verification...");

    res.json({
      success: true,
      mfaRequired: true,
      message: "Please enter your Google Authenticator code.",
      mfaToken
    });
  } catch (error) {
    console.error("Login controller CRASH:", error);
    res.status(500).json({ success: false, message: "Server error during login", details: error.message });
  }
};

// SEND EMAIL OTP
exports.sendEmailOtp = async (req, res) => {
  try {
    const { mfaToken, purpose } = req.body;
    if (!mfaToken) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // Decode temp token
    const decoded = jwt.verify(mfaToken, MFA_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    // Generate 6-digit Email OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOtp = otpCode;
    await user.save();

    console.log("Sending OTP email to:", user.email);

    let subject = "Your Login Verification Code";
    let title = "Login Verification";
    let message = "Please use the following 6-digit code to complete your login.";

    if (purpose === 'reset_mfa') {
      subject = "Authenticator Reset Verification";
      title = "Authenticator Reset";
      message = "Please use the following 6-digit code to verify your identity and reset your Google Authenticator.";
    }

    try {
      await sendEmail({
        to: user.email,
        subject: subject,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 16px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.05); color: #11253e;">
            <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${title}</h1>
            <p style="color: #64748b; font-size: 16px; margin-bottom: 32px;">${message}</p>
            
            <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
              <div style="font-family: monospace; font-size: 32px; font-weight: 700; color: #f99d1c; letter-spacing: 8px;">
                ${otpCode}
              </div>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">This code will expire in 15 minutes.</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0;" />
            <p style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em;">SahajCRM Admin Security Layer</p>
          </div>
        `
      });
      res.json({ success: true, message: "Email OTP sent successfully" });
    } catch (emailErr) {
      console.warn("⚠️ Email delivery failed:", emailErr.message);
      res.status(500).json({ success: false, message: "Failed to send email OTP" });
    }
  } catch (error) {
    console.error("sendEmailOtp CRASH:", error);
    res.status(500).json({ success: false, message: "Server error", details: error.message });
  }
};

// RESET MFA QR CODE
exports.resetMfaQr = async (req, res) => {
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

    const cleanOtp = String(otp).trim();
    if (!user.emailOtp || cleanOtp !== user.emailOtp) {
      return res.status(400).json({ success: false, message: "Invalid Email OTP" });
    }

    // Clear the OTP so it can't be reused
    user.emailOtp = "";

    // Generate new MFA Secret
    console.log("Generating new MFA secret for:", user.email);
    const secret = otplib.generateSecret();
    const service = "Hutech Admin";
    const otpauth = `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(service)}`;
    const qrCodeUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'H', margin: 4, width: 300 });
    
    user.mfaSecret = secret;
    user.mfaEnabled = true;
    await user.save();

    const qrCodeHtml = `
      <div style="background: #f8fafc; padding: 32px; border-radius: 12px; margin-bottom: 32px;">
        <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #11253e; margin-bottom: 16px;">New Google Authenticator QR Code</h2>
        <img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px; border-radius: 12px; border: 8px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        <p style="color: #64748b; font-size: 14px; margin-top: 16px;">Scan this new code with Google Authenticator.</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
        <h2 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #11253e; margin-bottom: 12px;">Manual Setup Key</h2>
        <div style="font-family: monospace; font-size: 20px; font-weight: 700; color: #f99d1c; padding: 12px; background: white; border: 1px dashed #cbd5e1; border-radius: 8px; display: inline-block; letter-spacing: 4px;">
          ${secret}
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Your New Google Authenticator QR Code",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 16px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.05); color: #11253e;">
            <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Authenticator Reset</h1>
            <p style="color: #64748b; font-size: 16px; margin-bottom: 32px;">Your Google Authenticator has been successfully reset.</p>
            ${qrCodeHtml}
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0;" />
            <p style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em;">SahajCRM Admin Security Layer</p>
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
      res.json({ success: true, message: "A new QR Code has been emailed to you." });
    } catch (emailErr) {
      console.warn("⚠️ Email delivery failed:", emailErr.message);
      res.status(500).json({ success: false, message: "Failed to send QR code email." });
    }
  } catch (error) {
    console.error("resetMfaQr CRASH:", error);
    res.status(500).json({ success: false, message: "Server error", details: error.message });
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

    const cleanOtp = String(otp).trim();
    
    // Check if it matches Email OTP
    let isValid = (user.emailOtp && cleanOtp === user.emailOtp);
    
    // Check if it matches Google Authenticator (TOTP)
    if (!isValid && user.mfaSecret) {
      try {
        const verifyResult = await otplib.verify({ token: cleanOtp, secret: user.mfaSecret });
        isValid = Boolean(verifyResult && verifyResult.valid);
      } catch (err) {
        // If mfaSecret is malformed (e.g. from earlier Email OTP experiment), otplib throws an error.
        console.warn("otplib verify error (likely malformed secret):", err.message);
      }
    }
    
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid Authenticator or OTP code" });
    }

    // Clear the Email OTP so it can't be reused
    user.emailOtp = "";

    // Mark MFA active if not already
    if (!user.mfaEnabled) {
      user.mfaEnabled = true;
      await user.save();
    }

    if (decoded.purpose === 'forgot_password') {
      user.mustChangePassword = true;
      await user.save();
    }

    let companySlug = null;
    if (user.companyId) {
      const company = await Company.findById(user.companyId);
      if (company) {
        companySlug = company.slug;
      }
    }

    // Generate real access token with role and companyId for tenant isolation
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companySlug,
      },
      SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companySlug: companySlug,
        mustChangePassword: user.mustChangePassword || false,
        needsCompanySetup: !user.companyId && !['superadmin', 'super_editor', 'super_viewer'].includes(user.role)
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

// CHANGE / UPDATE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ success: false, message: "Server error updating password" });
  }
};

// CHANGE PASSWORD TEMP (Before MFA Setup)
exports.changePasswordTemp = async (req, res) => {
  try {
    const { mfaToken, newPassword } = req.body;
    if (!mfaToken || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Invalid request or password too short." });
    }

    const decoded = jwt.verify(mfaToken, MFA_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustChangePassword = false;

    let qrCodeUrl = null;
    if (!user.mfaEnabled) {
      const secret = otplib.generateSecret();
      const service = "Hutech Admin";
      const otpauth = `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(service)}`;
      qrCodeUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'H', margin: 4, width: 300 });
      user.mfaSecret = secret;
    }

    await user.save();

    res.json({ 
      success: true, 
      mfaSetupRequired: !user.mfaEnabled,
      qrCodeUrl,
      mfaToken
    });
  } catch (error) {
    console.error("Temp password update error:", error);
    res.status(500).json({ success: false, message: "Server error updating password" });
  }
};

// SETUP COMPANY & WEBSITE AFTER MFA
exports.setupCompany = async (req, res) => {
  try {
    const { companyName, siteUrl, adminEmail, fromEmailName, adminSmtp } = req.body;
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ success: false, message: "Company name is required." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const finalAdminEmail = adminEmail?.trim().toLowerCase() || user.email;
    const finalFromEmailName = fromEmailName?.trim() || user.name;

    // Build Smtp payload if provided
    let smtpPayload = undefined;
    if (adminSmtp && (adminSmtp.user || adminSmtp.host)) {
      smtpPayload = {
        host: adminSmtp.host?.trim() || undefined,
        port: adminSmtp.port ? Number(adminSmtp.port) : 587,
        user: adminSmtp.user?.trim() || undefined,
        pass: adminSmtp.pass ? encrypt(adminSmtp.pass) : undefined,
        secure: Boolean(adminSmtp.secure),
      };
    }

    // Create Company
    const companySlug = await resolveUniqueSlug(companyName, Company);
    const company = await Company.create({
      name: companyName.trim(),
      slug: companySlug,
      adminEmail: finalAdminEmail,
      fromEmailName: finalFromEmailName,
      adminSmtp: smtpPayload,
      isActive: true,
    });

    // Create Website if URL provided
    let website = null;
    if (siteUrl && siteUrl.trim()) {
      const websiteSlug = await resolveUniqueSlug(companyName, Website);
      website = await Website.create({
        name: `${companyName.trim()} Main Site`,
        slug: websiteSlug,
        url: siteUrl.trim(),
        companyId: company._id,
        isActive: true,
      });
    }

    // Update User
    user.companyId = company._id;
    user.role = 'company_admin';
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
      SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      message: "Company setup complete",
      token,
      company,
      website,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companySlug: company.slug,
        needsCompanySetup: false
      }
    });
  } catch (error) {
    console.error("Setup company error:", error);
    res.status(500).json({ success: false, message: "Server error setting up company", details: error.message });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return success anyway to prevent email enumeration
      return res.json({ success: true, mfaRequired: true, message: "If this email is registered, please authenticate to reset your password.", mfaEnabled: false });
    }

    const mfaToken = jwt.sign({ id: user._id, email: user.email, purpose: 'forgot_password' }, MFA_SECRET, { expiresIn: '15m' });

    res.json({
      success: true,
      mfaRequired: true,
      message: "Please authenticate to reset your password.",
      mfaToken,
      mfaEnabled: user.mfaEnabled
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};