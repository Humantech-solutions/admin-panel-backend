const mongoose = require('mongoose');

const sentNotificationSchema = new mongoose.Schema({
  blogId: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SentNotification', sentNotificationSchema);
