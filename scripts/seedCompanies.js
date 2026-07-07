const mongoose = require('mongoose');
const Company = require('../src/models/companyModel');
const Contact = require('../src/models/contactModel');
const Career = require('../src/models/careerModel');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nabhiraAdmin_db';

const defaultCompanies = [];

async function seedAndMigrate() {
  try {
    console.log(`Connecting to MongoDB at: ${mongoURI}...`);
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB.');

    // 1. Seed companies
    const seededCompaniesMap = {};
    for (const comp of defaultCompanies) {
      let existing = await Company.findOne({ slug: comp.slug });
      if (!existing) {
        existing = new Company(comp);
        await existing.save();
        console.log(`Created company: ${comp.name} (${comp.slug})`);
      } else {
        console.log(`Company already exists: ${comp.name} (${comp.slug})`);
      }
      // Save ID reference for backfilling
      seededCompaniesMap[comp.slug] = existing._id;
    }

    // 2. Backfill Contacts
    console.log('\n--- Migrating Contacts ---');
    const contacts = await Contact.find({ companyId: { $exists: false } }).lean();
    console.log(`Found ${contacts.length} contacts requiring migration.`);
    
    let contactsMigrated = 0;
    for (const contact of contacts) {
      const slug = (contact.project || 'nabhira').toLowerCase();
      const companyId = seededCompaniesMap[slug] || seededCompaniesMap['nabhira'];
      
      if (companyId) {
        await Contact.updateOne({ _id: contact._id }, { $set: { companyId } });
        contactsMigrated++;
      }
    }
    console.log(`Successfully migrated ${contactsMigrated}/${contacts.length} contact records.`);

    // 3. Backfill Careers
    console.log('\n--- Migrating Careers ---');
    const applications = await Career.find({ companyId: { $exists: false } }).lean();
    console.log(`Found ${applications.length} applications requiring migration.`);
    
    let applicationsMigrated = 0;
    for (const app of applications) {
      const slug = (app.project || 'nabhira').toLowerCase();
      const companyId = seededCompaniesMap[slug] || seededCompaniesMap['nabhira'];
      
      if (companyId) {
        await Career.updateOne({ _id: app._id }, { $set: { companyId } });
        applicationsMigrated++;
      }
    }
    console.log(`Successfully migrated ${applicationsMigrated}/${applications.length} career records.`);

    console.log('\n✅ Database migration and seeding completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

seedAndMigrate();
