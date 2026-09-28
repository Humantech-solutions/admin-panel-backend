const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailUtil');

// Helper to determine if current user is super user
const isSuper = (role) => ['superadmin', 'super_editor', 'super_viewer'].includes(role);

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    let query = {};
    if (isSuper(req.user.role)) {
      query.companyId = null;
    } else {
      query.companyId = req.user.companyId;
    }
    const users = await User.find(query).select('-password -mfaSecret');
    const usersWithStatus = users.map(u => {
      const userObj = u.toObject();
      if (!userObj.mfaEnabled && userObj.mustChangePassword) {
        userObj.status = 'invited';
      } else {
        userObj.status = 'active';
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
    const { name, email, password, role } = req.body;
    
    // Check if authorized
    if (req.user.role !== 'superadmin' && req.user.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: "Not authorized to add collaborators" });
    }

    // Validate role
    let validRoles = [];
    if (req.user.role === 'superadmin') {
      validRoles = ['superadmin', 'super_editor', 'super_viewer'];
    } else {
      validRoles = ['company_admin', 'company_editor', 'company_viewer'];
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role for this context" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      companyId: isSuper(req.user.role) ? null : req.user.companyId,
      mfaEnabled: false,
      mustChangePassword: true, // Force password change on login
    });

    await newUser.save();
    
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`;
    const html = `
      <h2>You have been invited!</h2>
      <p>Hello ${name},</p>
      <p>You have been invited to join as a collaborator.</p>
      <p>Your temporary password is: <strong>${tempPassword}</strong></p>
      <p>Please <a href="${loginUrl}">login here</a>. Upon your first login, you will be prompted to set up Google Authenticator and change your password.</p>
    `;
    await sendEmail({
      to: email.toLowerCase(),
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
    const { role } = req.body;
    
    if (req.user.role !== 'superadmin' && req.user.role !== 'company_admin') {
      return res.status(403).json({ success: false, message: "Not authorized to edit collaborators" });
    }

    const userToEdit = await User.findById(req.params.id);
    if (!userToEdit) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Ensure they can only edit users in their scope
    if (isSuper(req.user.role) && userToEdit.companyId !== null) {
      return res.status(403).json({ success: false, message: "Cannot edit company user from super admin" });
    }
    if (!isSuper(req.user.role) && String(userToEdit.companyId) !== String(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Cannot edit user from another company" });
    }

    let validRoles = isSuper(req.user.role) ? ['superadmin', 'super_editor', 'super_viewer'] : ['company_admin', 'company_editor', 'company_viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    if (role) userToEdit.role = role;
    await userToEdit.save();

    res.json({ success: true, message: "Collaborator updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Server error updating collaborator" });
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

    // Ensure they can only delete users in their scope
    if (isSuper(req.user.role) && userToEdit.companyId !== null) {
      return res.status(403).json({ success: false, message: "Cannot delete company user from super admin" });
    }
    if (!isSuper(req.user.role) && String(userToEdit.companyId) !== String(req.user.companyId)) {
      return res.status(403).json({ success: false, message: "Cannot delete user from another company" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Collaborator removed successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Server error removing collaborator" });
  }
};
