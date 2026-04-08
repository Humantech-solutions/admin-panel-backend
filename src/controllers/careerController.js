const Career = require('../models/careerModel');
const { sendEmail } = require('../utils/emailUtil');

// SUBMIT APPLICATION
exports.submitApplication = async (req, res) => {
  try {
    const { name, email, linkedin, pageTitle, pageUrl } = req.body;
    
    // In a real app, we'd handle file upload for resume here. 
    // For now, we'll store the textual data.
    
    const newApplication = new Career({
      name,
      email,
      linkedin,
      pageTitle,
      pageUrl
    });

    await newApplication.save();

    // Trigger automated notification email to admin
    const adminLink = "http://localhost:3000/admin/dashboard/career";
    
    await sendEmail({
      to: 'deepsikha@hutechsolutions.com',
      subject: `New Job Application Received: ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">New Job Application Received</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; width: 120px;">Name</td>
              <td style="padding: 8px 0; color: #11253e; font-weight: bold;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</td>
              <td style="padding: 8px 0; color: #11253e;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">LinkedIn</td>
              <td style="padding: 8px 0; color: #11253e;">
                ${linkedin ? `<a href="${linkedin}" style="color: #f99d1c;">${linkedin}</a>` : 'Not provided'}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Page URL</td>
              <td style="padding: 8px 0; color: #11253e;">${pageUrl || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Page Title</td>
              <td style="padding: 8px 0; color: #11253e;">${pageTitle || 'N/A'}</td>
            </tr>
          </table>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${adminLink}" style="background-color: #f99d1c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">View in Admin Dashboard</a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #aaa;">This notification was sent from the Nabhira Careers page.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Application submitted successfully" });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ success: false, message: "Server error during submission" });
  }
};

// SUBMIT BROCHURE REQUEST
exports.submitBrochureRequest = async (req, res) => {
  try {
    const { name, email, pageTitle, pageUrl } = req.body;
    
    const newMail = new Career({
      name,
      email,
      pageTitle,
      pageUrl,
      type: 'brochure'
    });

    await newMail.save();

    // Trigger automated email
    const brochureLink = "http://localhost:3002/Nabhira_Careers_Brochure.pdf"; 
    await sendEmail({
      to: email,
      subject: "Your Nabhira Careers Brochure",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">Hello ${name},</h2>
          <p>Thank you for your interest in Nabhira Technologies. We are excited to share our 2026 Careers Brochure and Internship Guide with you.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${brochureLink}" style="background-color: #f99d1c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Download Your Brochure</a>
          </div>
          <p>At Nabhira, we believe in architecting the future with precision and integrity. We look forward to seeing the impact you'll make.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">This is an automated message from Nabhira Technologies Talent Team.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Brochure link sent to your email!" });
  } catch (error) {
    console.error("Brochure error:", error);
    res.status(500).json({ success: false, message: "Server error during brochure request" });
  }
};

// GET ALL APPLICATIONS
exports.getAllApplications = async (req, res) => {
  try {
    const applications = await Career.find().sort({ appliedAt: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching applications" });
  }
};

// GET SINGLE APPLICATION
exports.getApplicationById = async (req, res) => {
  try {
    const application = await Career.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }
    res.json({ success: true, application });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching application" });
  }
};
