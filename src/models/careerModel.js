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
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Career', careerSchema);
