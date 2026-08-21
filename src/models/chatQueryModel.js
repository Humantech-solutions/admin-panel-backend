const mongoose = require('mongoose');

const chatQuerySchema = new mongoose.Schema({
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  query: { type: String, required: true },
  pageUrl: { type: String, default: '' },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false,
  },
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: false,
    index: true,
  },
  submittedAt: { type: Date, default: Date.now }
});

chatQuerySchema.index({ websiteId: 1, submittedAt: -1 });

module.exports = mongoose.model('ChatQuery', chatQuerySchema);
