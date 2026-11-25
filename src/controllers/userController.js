const User = require('../models/userModel');
const Company = require('../models/companyModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const otplib = require('otplib');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailUtil');

// Helper to determine if current user is super user
const isSuper = (role) => ['superadmin', 'super_editor', 'super_viewer'].includes(role);

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    let query = {};
    if (isSuper(req.user.role)) {
      if (req.query.companyId && req.query.companyId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(req.query.companyId)) {
          query.companyId = req.query.companyId;
        } else {
          const comp = await Company.findOne({ slug: req.query.companyId });
          if (comp) query.companyId = comp._id;
        }
      } else if (req.query.all === 'true') {
        // Return all users across platform
      } else {
        query.companyId = null;
      }
    } else {
      query.companyId = req.user.companyId;
    }

    const users = await User.find(query).select('-password -mfaSecret');
    const usersWithStatus = users.map(u => {
      const userObj = u.toObject();
      if (!userObj.mfaEnabled && userObj.mustChangePassword) {
        userObj.status = 'invited';
      } else {
        userObj.status = userObj.status || 'active';
      }
      return userObj;
    });

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ success: false, message: "Server error fetching users" });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, companyId } = req.body;
    
    // Check if authorized
    if (req.user.role !== 'superadmin' && req.user.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: "Not authorized to add collaborators" });
    }

    // Validate role
    let validRoles = [];
    if (req.user.role === 'superadmin') {
      validRoles = ['superadmin', 'super_editor', 'super_viewer', 'company_admin', 'company_editor', 'company_viewer'];
    } else {
      validRoles = ['company_admin', 'company_editor', 'company_viewer'];
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role for this context" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    // Resolve companyId: company_admin always assigns their own companyId; superadmin can pass companyId
    let targetCompanyId = null;
    let companyName = "Hutech CRM";
    if (role.startsWith('company_')) {
      if (req.user.role === 'superadmin') {
        if (companyId) {
          if (mongoose.Types.ObjectId.isValid(companyId)) {
            targetCompanyId = companyId;
          } else {
            const comp = await Company.findOne({ slug: companyId });
            if (comp) targetCompanyId = comp._id;
          }
        }
      } else {
        targetCompanyId = req.user.companyId;
      }
    }

    if (targetCompanyId) {
      const comp = await Company.findById(targetCompanyId);
      if (comp) companyName = comp.name;
    }

    // 1. Generate Google Authenticator TOTP Secret & QR Code
    const mfaSecret = otplib.generateSecret();
    const serviceName = process.env.MFA_SERVICE_NAME || `${companyName} Admin`;
    const otpauth = `otpauth://totp/${encodeURIComponent(serviceName)}:${encodeURIComponent(cleanEmail)}?secret=${mfaSecret}&issuer=${encodeURIComponent(serviceName)}`;
    const qrCodeUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'H', margin: 4, width: 300 });

    // 2. Generate temporary password & hash
    const tempPassword = password || crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // 3. Save new user with pre-configured Google Authenticator secret
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role,
      companyId: targetCompanyId,
      mfaSecret,
      mfaEnabled: true,
      mustChangePassword: true, // Force password change on first login
    });

    await newUser.save();
    
    // 4. Construct rich onboarding email with embedded QR scanner and credentials
    const loginUrl = `${process.env.ADMIN_URL || process.env.FRONTEND_URL || 'https://admin.hutechsolutions.in'}/login`;
    const roleDisplayName = role === 'company_admin' ? 'Company Administrator'
      : role === 'company_editor' ? 'Content Editor'
      : role === 'company_viewer' ? 'Viewer (Read-Only)'
      : role === 'superadmin' ? 'Platform Superadmin'
      : role === 'super_editor' ? 'Platform Editor'
      : 'Platform Viewer';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 30px auto; padding: 0; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); color: #11253e;">
        <div style="background: linear-gradient(135deg, #11253e 0%, #1a385c 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome to ${companyName}</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">Admin Portal Access &amp; Two-Factor Security Setup</p>
        </div>

        <div style="padding: 32px 32px 24px 32px;">
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; color: #334155;">
            Hello <strong>${name.trim()}</strong>,
          </p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #475569;">
            An account has been created for you with the role of <strong>${roleDisplayName}</strong>. Below are your temporary login credentials along with your <strong>Google Authenticator QR Code</strong> to activate Two-Factor Authentication (2FA).
          </p>

          <!-- Credentials Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
            <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Your Account Credentials</p>
            <div style="font-size: 14px; margin-bottom: 8px;"><strong>Login Email:</strong> <span style="color: #11253e;">${cleanEmail}</span></div>
            <div style="font-size: 14px;"><strong>Temporary Password:</strong> <code style="font-family: monospace; font-size: 16px; font-weight: 700; color: #f99d1c; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${tempPassword}</code></div>
          </div>

          <!-- Google Authenticator QR Box -->
          <div style="background-color: #ffffff; border: 2px solid #f1f5f9; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: inline-block; background-color: #f99d1c; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px;">Step 1: Scan with Google Authenticator</div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #11253e;">Set Up Two-Factor Authentication</h3>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
              Open the <strong>Google Authenticator</strong> app on your mobile device (or Microsoft Authenticator / Authy), tap the <strong>+ (Add)</strong> button, and scan the QR code below:
            </p>
            
            <div style="display: inline-block; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 16px;">
              <img src="cid:qrcode" alt="Google Authenticator QR Code" width="220" height="220" style="display: block; border-radius: 8px;" />
            </div>

            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">Can't scan the QR code? Enter this manual setup key into your authenticator app:</p>
            <div style="font-family: monospace; font-size: 18px; font-weight: 700; color: #11253e; background: #f8fafc; padding: 10px 18px; border: 1px dashed #cbd5e1; border-radius: 8px; display: inline-block; letter-spacing: 4px;">
              ${mfaSecret}
            </div>
          </div>

          <!-- Step 2: Login -->
          <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 8px;">Step 2: Sign In &amp; Change Password</div>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
              <li>Click the button below to open the Admin Portal login page.</li>
              <li>Sign in using your email and temporary password.</li>
              <li>When prompted for your 6-digit code, enter the current code from your Google Authenticator app.</li>
              <li>Set your new permanent password to complete setup.</li>
            </ol>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #f99d1c; color: #ffffff; padding: 14px 36px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 157, 28, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
              Login to Admin Portal &rarr;
            </a>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            If you did not expect this invitation or need assistance, please contact your administrator.
          </p>
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding: 16px 32px; background-color: #fafafa; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">SahajCRM Enterprise Security Layer</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: cleanEmail,
        subject: `Welcome to ${companyName} — Credentials & Google Authenticator Setup`,
        html,
        attachments: [
          {
            filename: 'qrcode.png',
            content: qrCodeUrl.split('base64,')[1],
            encoding: 'base64',
            cid: 'qrcode'
          }
        ]
      });
    } catch (emailErr) {
      console.warn("⚠️ Invitation email delivery warning:", emailErr.message);
    }

    const userToReturn = newUser.toObject();
    delete userToReturn.password;
    delete userToReturn.mfaSecret;

    res.json({ success: true, message: "User added successfully and setup email sent with Google Authenticator QR Code", user: userToReturn });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, message: "Server error adding collaborator" });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    
    // Check if authorized
    if (req.user.role !== 'superadmin' && req.user.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: "Not authorized to edit users" });
    }

    const userToEdit = await User.findById(req.params.id);
    if (!userToEdit) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Tenant isolation:
    // Superadmin has global privilege to manage any user.
    // Company admin can only manage users within their own company.
    if (!isSuper(req.user.role)) {
      if (String(userToEdit.companyId) !== String(req.user.companyId)) {
        return res.status(403).json({ success: false, message: "Cannot edit user from another company" });
      }
    }

    // Validate and update role if provided
    if (role) {
      let validRoles = [];
      if (req.user.role === 'superadmin') {
        validRoles = ['superadmin', 'super_editor', 'super_viewer', 'company_admin', 'company_editor', 'company_viewer'];
      } else {
        validRoles = ['company_admin', 'company_editor', 'company_viewer'];
      }

      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role specified" });
      }
      userToEdit.role = role;
    }

    // Update full name if provided
    if (name && typeof name === 'string' && name.trim()) {
      userToEdit.name = name.trim();
    }

    // Update email if provided (with uniqueness check)
    if (email && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail !== userToEdit.email) {
        const existing = await User.findOne({ email: cleanEmail, _id: { $ne: userToEdit._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: "Another user already exists with this email address" });
        }
        userToEdit.email = cleanEmail;
      }
    }

    // Update status if provided
    if (status) {
      userToEdit.status = status;
    }

    await userToEdit.save();

    const userToReturn = userToEdit.toObject();
    delete userToReturn.password;
    delete userToReturn.mfaSecret;

    res.json({ success: true, message: "User updated successfully", user: userToReturn });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Server error updating user", details: error.message });
  }
};

// PUT /api/users/:id/password
exports.changeUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters long" });
    }

    if (req.user.role !== 'superadmin' && req.user.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: "Not authorized to reset passwords" });
    }

    const userToEdit = await User.findById(req.params.id);
    if (!userToEdit) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Tenant check
    if (!isSuper(req.user.role)) {
      if (String(userToEdit.companyId) !== String(req.user.companyId)) {
        return res.status(403).json({ success: false, message: "Cannot edit user from another company" });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    userToEdit.password = hashedPassword;
    userToEdit.mustChangePassword = false;
    await userToEdit.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change user password error:", error);
    res.status(500).json({ success: false, message: "Server error updating password" });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: "Not authorized to delete collaborators" });
    }

    const userToEdit = await User.findById(req.params.id);
    if (!userToEdit) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    if (String(userToEdit._id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "Cannot delete yourself" });
    }

    // Ensure company admin can only delete users in their own company; superadmin can delete any
    if (!isSuper(req.user.role)) {
      if (String(userToEdit.companyId) !== String(req.user.companyId)) {
        return res.status(403).json({ success: false, message: "Cannot delete user from another company" });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Collaborator removed successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Server error removing collaborator" });
  }
};
