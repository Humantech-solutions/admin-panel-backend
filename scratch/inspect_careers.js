const mongoose = require('mongoose');
require('dotenv').config();
const Career = require('../src/models/careerModel');

async function inspect() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nabhiraAdmin_db';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const careers = await Career.find({});
    console.log(`Found ${careers.length} applications total:`);
    careers.forEach(c => {
      console.log(`ID: ${c._id}, Name: ${c.name}, Email: ${c.email}, Resume: ${c.resume}, Project: ${c.project}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
}

inspect();
