const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    // These should be in .env
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    });

    const mailOptions = {
      from: `"Nabhira Technologies" <${process.env.SMTP_USER || 'deepsikha@hutechsolutions.com'}>`,
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
