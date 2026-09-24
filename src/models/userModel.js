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
    enum: ['superadmin', 'company_admin', 'company_user', 'viewer'],
    default: 'superadmin'
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