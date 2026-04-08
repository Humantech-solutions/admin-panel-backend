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
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
