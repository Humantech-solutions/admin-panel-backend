const EventRegistration = require('../models/eventRegistrationModel');
const { sendEmail } = require('../utils/emailUtil');
const { resolveCompanyAndWebsite } = require('../utils/resolverUtil');

// SUBMIT REGISTRATION
exports.submitRegistration = async (req, res) => {
  try {
    const { 
      eventTitle, 
      firstName, 
      lastName, 
      email, 
      company, 
      jobTitle, 
      interests, 
      pageTitle, 
      pageUrl 
    } = req.body;
    
    const resolved = await resolveCompanyAndWebsite(req.body, req);

    const newRegistration = new EventRegistration({
      eventTitle,
      firstName,
      lastName,
      email,
      company,
      jobTitle,
      interests,
      pageTitle,
      pageUrl,
      companyId: resolved.companyId,
      websiteId: resolved.websiteId
    });

    await newRegistration.save();

    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Attendee';

    // 1. Send Confirmation Email to User
    await sendEmail({
      to: email,
      fromName: `${resolved.fromEmailName} Events`,
      smtpConfig: resolved.salesSmtp,
      subject: `Registration Confirmed: ${eventTitle || 'Event'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">Registration Confirmed!</h2>
          <p>Hi <strong>${fullName}</strong>,</p>
          <p>Thank you for registering for <strong>${eventTitle || 'our event'}</strong>. We have reserved your spot.</p>
          <p>We look forward to having you join us.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #aaa;">${resolved.companyName} Events Team</p>
        </div>
      `
    });

    // 2. Send Alert Email to Company Admin
    await sendEmail({
      to: resolved.salesNotificationEmail,
      fromName: `${resolved.companyName} Admin Portal`,
      smtpConfig: resolved.salesSmtp,
      subject: `[${resolved.companyName}] New Event Registration: ${eventTitle} by ${fullName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e; border-bottom: 2px solid #f99d1c; padding-bottom: 10px;">New Event Attendee Registered</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; width: 120px;">Name</td>
              <td style="padding: 8px 0; color: #11253e; font-weight: bold;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase;">Email</td>
              <td style="padding: 8px 0; color: #11253e;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase;">Event</td>
              <td style="padding: 8px 0; color: #11253e; font-weight: bold;">${eventTitle || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase;">Company / Org</td>
              <td style="padding: 8px 0; color: #11253e;">${company || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase;">Job Title</td>
              <td style="padding: 8px 0; color: #11253e;">${jobTitle || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase;">Target Portal</td>
              <td style="padding: 8px 0; color: #11253e;">${resolved.websiteName ? `${resolved.websiteName} (${resolved.companyName})` : resolved.companyName}</td>
            </tr>
          </table>
        </div>
      `
    });

    res.json({ success: true, message: "Registration submitted successfully" });
  } catch (error) {
    console.error("Registration submission error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// GET ALL REGISTRATIONS (with tenant & website isolation)
exports.getAllRegistrations = async (req, res) => {
  try {
    const { company, project, website } = req.query;
    const filter = {};

    // Block Superadmin from accessing organization lead data
    if (req.user && req.user.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmin accounts manage platform onboarding and settings only and cannot access company lead data.' });
    }

    if (req.user && req.user.companyId) {
      filter.companyId = req.user.companyId;
    } else {
      return res.status(400).json({ success: false, message: 'Company account setup required.' });
    }

    if (website && website !== 'all') {
      const Website = require('../models/websiteModel');
      const foundWeb = await Website.findOne({
        $or: [
          { slug: website.toLowerCase() },
          ...(website.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: website }] : [])
        ]
      }).lean();
      if (foundWeb) {
        filter.websiteId = foundWeb._id;
      }
    }

    const registrations = await EventRegistration.find(filter)
      .populate('companyId', 'name slug')
      .populate('websiteId', 'name slug url')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({ success: true, registrations });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching registrations" });
  }
};
