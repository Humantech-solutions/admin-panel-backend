
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log("Checking credentials...");
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_PORT:", process.env.SMTP_PORT);
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("SMTP_PASS length:", process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("✅ Connection is successful");
  } catch (error) {
    console.error("❌ Connection failed:", error);
  }
}

testEmail();
