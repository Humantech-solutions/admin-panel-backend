const mongoose = require('mongoose');

const salesMailSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  pageTitle: { type: String, required: true },
  pageUrl: { type: String, required: true },
  requestedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SalesMail', salesMailSchema);
