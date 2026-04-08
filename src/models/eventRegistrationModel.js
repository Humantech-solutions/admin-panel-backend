const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  eventTitle: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: false
  },
  jobTitle: {
    type: String,
    required: false
  },
  interests: {
    type: String,
    required: false
  },
  pageTitle: {
    type: String,
    required: false
  },
  pageUrl: {
    type: String,
    required: false
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
