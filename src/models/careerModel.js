const mongoose = require('mongoose');

const careerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  linkedin: {
    type: String,
    required: false
  },
  type: {
    type: String,
    enum: ['application', 'brochure'],
    default: 'application'
  },
  resume: {
    type: String, // This will be the file path or identifier
    required: false
  },
  pageTitle: {
    type: String,
    required: true
  },
  pageUrl: {
    type: String,
    required: true
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
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Optimize indexing for dynamic filters
careerSchema.index({ companyId: 1 });
careerSchema.index({ websiteId: 1, createdAt: -1 });

module.exports = mongoose.model('Career', careerSchema);
