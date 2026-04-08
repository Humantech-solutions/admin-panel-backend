const ChatQuery = require('../models/chatQueryModel');
const { sendEmail } = require('../utils/emailUtil');

// SUBMIT CHAT QUERY
exports.submitChatQuery = async (req, res) => {
  try {
    const { email, phone, query, pageUrl } = req.body;

    if (!email || !query) {
      return res.status(400).json({ success: false, message: 'Email and query are required.' });
    }

    const newQuery = new ChatQuery({ email, phone, query, pageUrl });
    await newQuery.save();

    // Send notification to admin
    await sendEmail({
      to: 'deepsikha@hutechsolutions.com',
      subject: `New Chat Query from ${email}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">New Chat Query Received</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; width: 120px;">Email</td>
              <td style="padding: 8px 0; color: #11253e; font-weight: bold;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Phone</td>
              <td style="padding: 8px 0; color: #11253e;">${phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; vertical-align: top;">Query</td>
              <td style="padding: 8px 0; color: #11253e;">${query}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Page</td>
              <td style="padding: 8px 0; color: #11253e;">${pageUrl || 'N/A'}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #aaa;">This notification was sent from the Nabhira website chatbot.</p>
        </div>
      `
    });

    // Send confirmation to user
    await sendEmail({
      to: email,
      subject: 'We received your message — Nabhira Technologies',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">Thank you for reaching out!</h2>
          <p style="color: #555;">We've received your message and our team will get back to you as soon as possible.</p>
          <div style="background: #f8f9fa; border-left: 4px solid #f99d1c; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
            <p style="font-size: 12px; color: #999; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your Query</p>
            <p style="color: #11253e; margin: 0;">${query}</p>
          </div>
          <p style="color: #555; font-size: 14px;">If this is urgent, you can also reach us at <a href="mailto:info@nabhira.com" style="color: #f99d1c;">info@nabhira.com</a>.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 11px; color: #aaa;">Nabhira Technologies — Architecting the Future.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'Query submitted successfully.' });
  } catch (error) {
    console.error('Chat query error:', error);
    res.status(500).json({ success: false, message: 'Server error during submission.' });
  }
};

// GET ALL CHAT QUERIES (Admin)
exports.getAllChatQueries = async (req, res) => {
  try {
    const queries = await ChatQuery.find().sort({ submittedAt: -1 });
    res.json({ success: true, queries });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching queries.' });
  }
};
