const mongoose = require('mongoose');
const User = require('./src/models/userModel');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nabhira_db';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB for seeding');

    const adminEmail = 'admin@nabhira.com';
    const adminPassword = 'admin@123';

    // Check if user already exists
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      console.log('⚠️ Admin user already exists in MongoDB.');
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const adminUser = new User({
        email: adminEmail,
        password: hashedPassword
      });
      await adminUser.save();
      console.log('✅ Admin user seeded successfully in MongoDB!');
    }

  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    mongoose.connection.close();
  }
}

seed();
