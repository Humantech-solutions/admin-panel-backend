const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'super_editor', 'super_viewer', 'company_admin', 'company_editor', 'company_viewer'],
    default: 'company_admin'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
  accessibleWebsites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website'
  }],
  mfaSecret: {
    type: String
  },
  emailOtp: {
    type: String
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

userSchema.index({ companyId: 1 });
userSchema.index({ email: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);