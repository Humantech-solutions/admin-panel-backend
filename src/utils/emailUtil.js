const nodemailer = require('nodemailer');
const { decrypt } = require('./cryptoUtil');

const sendEmail = async ({ to, subject, html, attachments = [], fromName, smtpConfig = null, replyTo = null }) => {
  try {
    // Determine dynamic vs fallback global SMTP credentials
    const hasCustomSmtp = smtpConfig && smtpConfig.user && smtpConfig.pass;

    const host = hasCustomSmtp && smtpConfig.host ? smtpConfig.host : process.env.SMTP_HOST;
    const port = hasCustomSmtp && smtpConfig.port ? parseInt(smtpConfig.port) : parseInt(process.env.SMTP_PORT || '587');
    const secure = hasCustomSmtp && (smtpConfig.secure !== undefined) ? Boolean(smtpConfig.secure) : (process.env.SMTP_SECURE === 'true');
    const user = hasCustomSmtp ? smtpConfig.user : process.env.SMTP_USER;
    const rawPass = hasCustomSmtp ? smtpConfig.pass : process.env.SMTP_PASS;
    const pass = decrypt(rawPass);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      }
    });

    const resolvedFromName = fromName || process.env.SMTP_SENDER_NAME || 'Hutech Solutions';
    const senderEmail = user || process.env.SMTP_USER;

    const mailOptions = {
      from: `"${resolvedFromName}" <${senderEmail}>`,
      to,
      subject,
      html,
      attachments,
      ...(replyTo && { replyTo })
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent via ${user}: ` + info.response);
    return { success: true, info };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
};


module.exports = { sendEmail };
