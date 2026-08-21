const mongoose = require('mongoose');

const salesMailSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  pageTitle: { type: String, required: true },
  pageUrl: { type: String, required: true },
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
  requestedAt: { type: Date, default: Date.now }
});

salesMailSchema.index({ websiteId: 1, requestedAt: -1 });

module.exports = mongoose.model('SalesMail', salesMailSchema);
