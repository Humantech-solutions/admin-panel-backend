const User = require('../models/userModel');
const Company = require('../models/companyModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
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

      // Platform superadmins and editors are always active
      if (['superadmin', 'super_editor', 'super_viewer'].includes(userObj.role)) {
        userObj.status = 'active';
        return userObj;
      }

      // If explicitly marked inactive
      if (userObj.status === 'inactive') {
        userObj.status = 'inactive';
        return userObj;
      }

      // Users who have completed password setup and onboarding are active
      if (!userObj.mustChangePassword) {
        userObj.status = 'active';
        return userObj;
      }

      // Only unaccepted invited users (with mustChangePassword: true and not yet accepted) are pending
      if (userObj.status === 'pending' || userObj.status === 'invited' || !userObj.inviteAccepted) {
        userObj.status = 'pending';
        return userObj;
      }

      userObj.status = 'active';
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

    // 1. Generate temporary password & hash
    const tempPassword = password || crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // 2. Save new user with pending status until invitation is accepted
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role,
      companyId: targetCompanyId,
      mfaSecret: null,
      mfaEnabled: false,
      status: 'pending',
      inviteAccepted: false,
      mustChangePassword: true, // Force password change on first login
    });

    await newUser.save();
    
    // 3. Construct invitation email (WITHOUT Google Authenticator QR scanner)
    const loginUrl = `${process.env.ADMIN_URL || process.env.FRONTEND_URL || 'https://admin.hutechsolutions.in'}/login`;
    const acceptInviteUrl = `${loginUrl}?email=${encodeURIComponent(cleanEmail)}&action=accept-invite`;
    const roleDisplayName = role === 'company_admin' ? 'Company Administrator'
      : role === 'company_editor' ? 'Content Editor'
      : role === 'company_viewer' ? 'Viewer (Read-Only)'
      : role === 'superadmin' ? 'Platform Superadmin'
      : role === 'super_editor' ? 'Platform Editor'
      : 'Platform Viewer';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 30px auto; padding: 0; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); color: #11253e;">
        <div style="background: linear-gradient(135deg, #11253e 0%, #1a385c 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Invitation to Join ${companyName}</h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">Accept your invitation to join the SahajCRM Admin Portal</p>
        </div>

        <div style="padding: 32px 32px 24px 32px;">
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; color: #334155;">
            Hello <strong>${name.trim()}</strong>,
          </p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #475569;">
            You have been invited to join <strong>${companyName}</strong> on the SahajCRM Admin Portal as a <strong>${roleDisplayName}</strong>.
          </p>

          <!-- Credentials Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
            <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Your Login Credentials</p>
            <div style="font-size: 14px; margin-bottom: 10px;"><strong>Email ID:</strong> <span style="color: #11253e; font-weight: 600;">${cleanEmail}</span></div>
            <div style="font-size: 14px;"><strong>Temporary Password:</strong> <code style="font-family: monospace; font-size: 16px; font-weight: 700; color: #f99d1c; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${tempPassword}</code></div>
          </div>

          <!-- Accept Invite Button -->
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${acceptInviteUrl}" style="display: inline-block; background-color: #f99d1c; color: #ffffff; padding: 16px 40px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 157, 28, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
              Accept Invitation &amp; Log In &rarr;
            </a>
          </div>

          <!-- Next Steps -->
          <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 10px;">How to Activate Your Account</div>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.8;">
              <li>Click the <strong>Accept Invitation &amp; Log In</strong> button above.</li>
              <li>Sign in using your email and temporary password provided above.</li>
              <li>Set your new permanent password.</li>
              <li>Scan the on-screen QR code with your <strong>Google Authenticator</strong> app to complete two-factor authentication.</li>
            </ol>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            Your account status is currently <strong>Pending</strong> and will automatically become <strong>Active</strong> once you accept this invitation and complete your first login.
          </p>
        </div>

        <div style="border-top: 1px solid #f1f5f9; padding: 16px 32px; background-color: #fafafa; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">SahajCRM Enterprise Security</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: cleanEmail,
        subject: `Invitation to Join ${companyName} — Accept Invite & Set Up Account`,
        html
      });
    } catch (emailErr) {
      console.warn("⚠️ Invitation email delivery warning:", emailErr.message);
    }

    const userToReturn = newUser.toObject();
    delete userToReturn.password;
    delete userToReturn.mfaSecret;

    res.json({ success: true, message: "User added successfully. Invitation sent via email (status: Pending)", user: userToReturn });
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
