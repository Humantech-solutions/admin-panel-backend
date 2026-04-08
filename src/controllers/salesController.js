const SalesMail = require('../models/salesMailModel');
const { sendEmail } = require('../utils/emailUtil');

// SUBMIT SALES BROCHURE REQUEST
exports.submitSalesBrochure = async (req, res) => {
  try {
    const { name, email, pageTitle, pageUrl } = req.body;

    const newMail = new SalesMail({
      name,
      email,
      pageTitle,
      pageUrl
    });

    await newMail.save();

    // Trigger automated email
    const brochureLink = "http://localhost:3002/Nabhira_Solutions_Brochure.pdf"; // Reusing the same dummy for now or specific one if available
    await sendEmail({
      to: email,
      subject: `Brochure: ${pageTitle} | Nabhira Technologies`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">Hello ${name},</h2>
          <p>Thank you for expressing interest in our <strong>${pageTitle}</strong> solution. We are pleased to share the requested brochure with you.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${brochureLink}" style="background-color: #f99d1c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Download Brochure</a>
          </div>
          <p>At Nabhira, we specialize in high-impact technology solutions designed to scale with your business. Our experts are ready to assist you in architecting the perfect solution for your needs.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">This is an automated message from Nabhira Technologies Sales Team.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Brochure link sent to your email!" });
  } catch (error) {
    console.error("Sales brochure submission error:", error);
    res.status(500).json({ success: false, message: "Server error during submission" });
  }
};

// GET ALL SALES MAILS (Admin only)
exports.getAllSalesMails = async (req, res) => {
  try {
    const mails = await SalesMail.find().sort({ requestedAt: -1 });
    res.json({ success: true, mails });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching sales mails" });
  }
};
