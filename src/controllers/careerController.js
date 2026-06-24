const Career = require('../models/careerModel');
const { sendEmail } = require('../utils/emailUtil');

// SUBMIT APPLICATION
exports.submitApplication = async (req, res) => {
  try {
    const { name, email, linkedin, pageTitle, pageUrl, project, companyName } = req.body;
    
    // Server-side validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Full Name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email Address is required" });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    if (!pageTitle || !pageTitle.trim() || !pageUrl || !pageUrl.trim()) {
      return res.status(400).json({ success: false, message: "Source page context is required" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Resume / CV file is required" });
    }

    const resolvedProject = project || 'nabhira';
    const resolvedCompanyName = companyName || 'Nabhira Technologies';
    
    const resumePath = `/uploads/resumes/${req.file.filename}`;
    
    const newApplication = new Career({
      name: name.trim(),
      email: email.trim(),
      linkedin: linkedin ? linkedin.trim() : undefined,
      pageTitle: pageTitle.trim(),
      pageUrl: pageUrl.trim(),
      project: resolvedProject,
      companyName: resolvedCompanyName,
      resume: resumePath
    });

    await newApplication.save();

    // Trigger automated notification email to admin
    const adminUrl = process.env.ADMIN_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const adminLink = `${adminUrl}/admin/dashboard/career?project=${resolvedProject}`;
    const resumeDownloadLink = `${backendUrl}${resumePath}`;
    
    await sendEmail({
      to: 'muthuprabha@hutechsolutions.com',
      fromName: `${resolvedCompanyName} Careers`,
      subject: `New Job Application Received: ${name} (${resolvedCompanyName})`,
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
              <td style="padding: 8px 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Resume / CV</td>
              <td style="padding: 8px 0; color: #11253e;">
                <a href="${resumeDownloadLink}" style="color: #f99d1c; font-weight: bold; text-decoration: underline;" target="_blank">Download Resume</a>
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
          <p style="font-size: 11px; color: #aaa;">This notification was sent from the ${resolvedCompanyName} Careers page.</p>
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
    const { name, email, pageTitle, pageUrl, project, companyName } = req.body;
    
    const resolvedProject = project || 'nabhira';
    const resolvedCompanyName = companyName || 'Nabhira Technologies';
    
    const newMail = new Career({
      name,
      email,
      pageTitle,
      pageUrl,
      type: 'brochure',
      project: resolvedProject,
      companyName: resolvedCompanyName
    });

    await newMail.save();

    // Trigger automated email
    const brochureUrl = process.env.BROCHURE_URL || 'http://localhost:3002';
    const brochureLink = resolvedProject === 'hutech' 
      ? `${brochureUrl}/Hutech_Careers_Brochure.pdf` 
      : resolvedProject === 'hulabs'
      ? `${brochureUrl}/Hulabs_Careers_Brochure.pdf`
      : `${brochureUrl}/Nabhira_Careers_Brochure.pdf`; 

    await sendEmail({
      to: email,
      fromName: `${resolvedCompanyName} Talent Team`,
      subject: `Your ${resolvedCompanyName} Careers Brochure`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e;">Hello ${name},</h2>
          <p>Thank you for your interest in ${resolvedCompanyName}. We are excited to share our 2026 Careers Brochure and Internship Guide with you.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${brochureLink}" style="background-color: #f99d1c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Download Your Brochure</a>
          </div>
          <p>At ${resolvedCompanyName}, we believe in architecting the future with precision and integrity. We look forward to seeing the impact you'll make.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">This is an automated message from ${resolvedCompanyName} Talent Team.</p>
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
    const { project } = req.query;
    const filter = project ? { project } : {};
    const applications = await Career.find(filter).sort({ appliedAt: -1 });
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
