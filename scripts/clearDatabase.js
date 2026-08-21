const mongoose = require('mongoose');
const path = require('path');
const User = require('../src/models/userModel');
const Company = require('../src/models/companyModel');
const Website = require('../src/models/websiteModel');
const Contact = require('../src/models/contactModel');
const Career = require('../src/models/careerModel');
const SalesMail = require('../src/models/salesMailModel');
const DocumentRequest = require('../src/models/documentRequestModel');
const EventRegistration = require('../src/models/eventRegistrationModel');
const ChatQuery = require('../src/models/chatQueryModel');
const seedDefaults = require('../src/utils/seeder');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adminpanel_crm';

async function clearAndResetDatabase() {
  try {
    console.log(`🔌 Connecting to MongoDB at ${mongoURI}...`);
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB.');

    console.log('🧹 Clearing all collections (Companies, Websites, Contacts, Careers, Sales, Requests)...');

    await Company.deleteMany({});
    await Website.deleteMany({});
    await Contact.deleteMany({});
    await Career.deleteMany({});
    await SalesMail.deleteMany({});
    await DocumentRequest.deleteMany({});
    await EventRegistration.deleteMany({});
    await ChatQuery.deleteMany({});

    // Delete non-superadmin users (keep Superadmin if present)
    await User.deleteMany({ role: { $ne: 'superadmin' } });

    console.log('✨ All test data cleared successfully!');

    // Ensure Superadmin exists
    console.log('🌱 Seeding fresh Superadmin user...');
    await seedDefaults();

    console.log('\n🎉 Database reset complete! Your database is now 100% clean with ONLY the Superadmin user.');
  } catch (err) {
    console.error('❌ Error clearing database:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Connection closed.');
  }
}

clearAndResetDatabase();
