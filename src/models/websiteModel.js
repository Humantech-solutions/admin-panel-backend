const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Website name is required'],
    trim: true,
  },
  // slug acts as the short prefix-code identifier, e.g. "nabhira", "hutech"
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  url: {
    type: String,
    trim: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company reference is required'],
    index: true,
  },
  // Optional website-specific SMTP to override company defaults
  smtpConfig: {
    host: { type: String, trim: true },
    port: { type: Number },
    user: { type: String, trim: true },
    pass: { type: String, trim: true },
    secure: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Compound index for fast company → websites lookups
websiteSchema.index({ companyId: 1, slug: 1 });

module.exports = mongoose.model('Website', websiteSchema);
