const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: false
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  pageTitle: {
    type: String,
    required: false
  },
  pageUrl: {
    type: String,
    required: false
  },
  category: {
    type: String,
    enum: ['Industries', 'Solutions', 'Case Study', 'Blog', 'Service', 'Career', 'Client', 'Footer', 'Contact', 'Other'],
    default: 'Contact'
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Closed'],
    default: 'New'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  },
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: false,
    index: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Optimize lookups and filtering
contactSchema.index({ companyId: 1 });
contactSchema.index({ websiteId: 1, createdAt: -1 });
contactSchema.index({ websiteId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);
