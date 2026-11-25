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

    const tempPassword = password || crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role,
      companyId: targetCompanyId,
      mfaEnabled: false,
      mustChangePassword: true, // Force password change on login
    });

    await newUser.save();
    
    const loginUrl = `${process.env.FRONTEND_URL || 'https://admin.hutechsolutions.in'}/login`;
    const html = `
      <h2>You have been invited!</h2>
      <p>Hello ${name},</p>
      <p>You have been invited to join as a team member.</p>
      <p>Your temporary password is: <strong>${tempPassword}</strong></p>
      <p>Please <a href="${loginUrl}">login here</a>. Upon your first login, you will be prompted to set up Google Authenticator and change your password.</p>
    `;
    await sendEmail({
      to: cleanEmail,
      subject: 'Invitation to Admin Panel',
      html,
    });

    const userToReturn = newUser.toObject();
    delete userToReturn.password;

    res.json({ success: true, message: "Collaborator added successfully", user: userToReturn });
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
