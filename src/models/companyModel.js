const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
  },
  adminEmail: {
    type: String,
    required: [true, 'Notification recipient email is required'],
    trim: true,
  },
  careersNotificationEmail: {
    type: String,
    trim: true,
  },
  salesNotificationEmail: {
    type: String,
    trim: true,
  },
  contactNotificationEmail: {
    type: String,
    trim: true,
  },
  fromEmailName: {
    type: String,
    trim: true
  },
  // Department-specific SMTP credentials
  adminSmtp: {
    host: { type: String, trim: true },
    port: { type: Number },
    user: { type: String, trim: true },
    pass: { type: String, trim: true },
    secure: { type: Boolean, default: false }
  },
  careersSmtp: {
    host: { type: String, trim: true },
    port: { type: Number },
    user: { type: String, trim: true },
    pass: { type: String, trim: true },
    secure: { type: Boolean, default: false }
  },
  salesSmtp: {
    host: { type: String, trim: true },
    port: { type: Number },
    user: { type: String, trim: true },
    pass: { type: String, trim: true },
    secure: { type: Boolean, default: false }
  },
  contactSmtp: {
    host: { type: String, trim: true },
    port: { type: Number },
    user: { type: String, trim: true },
    pass: { type: String, trim: true },
    secure: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Pre-save middleware to auto-generate slug from name if not provided
companySchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  next();
});

module.exports = mongoose.model('Company', companySchema);
