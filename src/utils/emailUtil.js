const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, attachments = [], fromName }) => {
  try {
    // These should be in .env
    // These should be in .env
      // Configure transporter dynamically using host and port (defaults to Outlook/Office 365)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // false for TLS/STARTTLS (587), true for SSL (465)
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      });

    const resolvedFromName = fromName || process.env.SMTP_SENDER_NAME || 'Nabhira Technologies';
    const mailOptions = {
      from: `"${resolvedFromName}" <${process.env.SMTP_USER || 'deepsikha@hutechsolutions.com'}>`,
      to,
      subject,
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return { success: true, info };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
};


module.exports = { sendEmail };
