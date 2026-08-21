const path = require('path');
const SalesMail = require('../models/salesMailModel');
const { sendEmail } = require('../utils/emailUtil');
const { resolveCompanyAndWebsite } = require('../utils/resolverUtil');
const { getOrUploadS3File } = require('../utils/s3Util');

// SUBMIT SALES BROCHURE REQUEST
exports.submitSalesBrochure = async (req, res) => {
  try {
    const { name, email, pageTitle, pageUrl } = req.body;

    const resolved = await resolveCompanyAndWebsite(req.body, req);

    const newMail = new SalesMail({
      name: name || 'Valued Customer',
      email,
      pageTitle,
      pageUrl,
      companyId: resolved.companyId,
      websiteId: resolved.websiteId
    });

    await newMail.save();

    // 1. Trigger automated email to User (uses direct full URL from .env if provided)
    const envBrochure = process.env.SALES_BROCHURE_URL || process.env.BROCHURE_URL;
    const brochureLink = (envBrochure && (envBrochure.startsWith('http') && (envBrochure.includes('.pdf') || envBrochure.includes('.doc'))))
      ? envBrochure
      : `${envBrochure || 'http://localhost:3002'}/hutech_solutions_brochure.pdf`;
    await sendEmail({
      to: email,
      fromName: `${resolved.fromEmailName} Sales`,
      subject: `Brochure: ${pageTitle} | ${resolved.companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">Hello ${name || 'Valued Customer'},</h2>
          <p>Thank you for expressing interest in our <strong>${pageTitle}</strong> solution. We are pleased to share the requested brochure with you.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${brochureLink}" style="background-color: #f99d1c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Download Brochure</a>
          </div>
          <p>At ${resolved.companyName}, we specialize in high-impact technology solutions. Our experts are ready to assist you in architecting the perfect solution for your needs.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">This is an automated message from ${resolved.companyName} Sales Team.</p>
        </div>
      `
    });

    // 2. Trigger automated notification email to Admin
    const adminUrl = process.env.ADMIN_URL || 'http://localhost:3000';
    const adminLink = `${adminUrl}/admin/dashboard/sales`;
    await sendEmail({
      to: resolved.adminNotificationEmail,
      fromName: `${resolved.companyName} Admin Portal`,
      subject: `[${resolved.companyName}] New Sales Brochure Lead: ${email}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e; border-bottom: 2px solid #f99d1c; padding-bottom: 10px;">New Sales Brochure Request Received</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase; width: 120px;">Name</td>
              <td style="padding: 10px; color: #11253e; font-weight: bold;">${name || 'Valued Customer'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Email</td>
              <td style="padding: 10px; color: #11253e;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Page Title</td>
              <td style="padding: 10px; color: #11253e;">${pageTitle || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Page URL</td>
              <td style="padding: 10px; color: #11253e;"><a href="${pageUrl || '#'}" style="color: #f99d1c;">${pageUrl || 'N/A'}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Target Portal</td>
              <td style="padding: 10px; color: #11253e;">${resolved.websiteName ? `${resolved.websiteName} (${resolved.companyName})` : resolved.companyName}</td>
            </tr>
          </table>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${adminLink}" style="background-color: #11253e; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">View in Admin Dashboard</a>
          </div>
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
