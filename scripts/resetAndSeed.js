const mongoose = require('mongoose');
const seedDefaults = require('../src/utils/seeder');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nabhiraAdmin_db';

async function run() {
  try {
    console.log(`Connecting to MongoDB at ${mongoURI}...`);
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB.');

    console.log('🌱 Seeding default Superadmin...');
    await seedDefaults();

    console.log('✅ Superadmin seeding complete!');
  } catch (err) {
    console.error('❌ Error resetting DB:', err);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

run();
