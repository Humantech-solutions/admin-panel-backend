const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
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
  project: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

subscriptionSchema.index({ email: 1, websiteId: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
