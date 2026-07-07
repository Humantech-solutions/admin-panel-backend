const mongoose = require('mongoose');

const documentRequestSchema = new mongoose.Schema({
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
  documentName: {
    type: String,
    required: true
  },
  document: {
    type: String,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  },
  project: {
    type: String,
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Optimize indexing for fast dashboard lookups and filtering queries
documentRequestSchema.index({ companyId: 1 });
documentRequestSchema.index({ companyId: 1, createdAt: -1 });
documentRequestSchema.index({ email: 1 });

module.exports = mongoose.model('DocumentRequest', documentRequestSchema);
