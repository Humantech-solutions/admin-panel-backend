const mongoose = require('mongoose');

const chatQuerySchema = new mongoose.Schema({
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  query: { type: String, required: true },
  pageUrl: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatQuery', chatQuerySchema);
