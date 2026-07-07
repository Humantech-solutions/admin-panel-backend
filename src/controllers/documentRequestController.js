const DocumentRequest = require('../models/documentRequestModel');
const Company = require('../models/companyModel');
const { sendEmail } = require('../utils/emailUtil');

// SUBMIT DOCUMENT DOWNLOAD REQUEST
exports.submitDocumentRequest = async (req, res) => {
  try {
    const { name, email, phone, documentName, document, project, companyName } = req.body;

    if (!name || !email || !documentName || !document) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, document name, and document resource are required." 
      });
    }

    const resolvedProject = project || 'nabhira';
    
    // Lookup target company dynamically
    const company = await Company.findOne({ slug: resolvedProject.toLowerCase() });
    
    const resolvedCompanyName = company ? company.name : (companyName || 'Nabhira Technologies');
    const adminNotificationEmail = company ? company.adminEmail : 'muthuprabha@hutechsolutions.com';
    const emailFromName = company ? (company.fromEmailName || company.name) : resolvedCompanyName;

    const newRequest = new DocumentRequest({
      name,
      email,
      phone,
      documentName,
      document,
      project: resolvedProject,
      companyName: resolvedCompanyName,
      companyId: company ? company._id : undefined
    });

    await newRequest.save();

    // 1. Dispatch stylized email to the User with the download option
    const downloadUrl = document.startsWith('http') ? document : `${process.env.BACKEND_URL || 'http://localhost:8001'}${document}`;
    
    await sendEmail({
      to: email,
      fromName: emailFromName,
      subject: `Your download is ready: ${documentName}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 24px; background-color: #ffffff; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.02);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #11253e 0%, #030213 100%); padding: 40px; text-align: center; color: #ffffff;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.25em; color: #f99d1c; margin-bottom: 12px;">RESOURCE DELIVERY</div>
            <h1 style="font-size: 26px; font-weight: 800; margin: 0; line-height: 1.2; letter-spacing: -0.02em;">Your Document is Ready</h1>
          </div>
          
          <!-- Content Body -->
          <div style="padding: 40px 50px; color: #334155;">
            <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Hi <strong>${name}</strong>,</p>
            
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Thank you for your interest in <strong>${resolvedCompanyName}</strong>. Below is the link to download the document you requested:
            </p>
            
            <!-- Document Details Card -->
            <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 16px; padding: 24px; margin: 30px 0; text-align: center;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">REQUESTED FILE</span>
              <span style="font-size: 18px; font-weight: 800; color: #11253e; display: block; margin-bottom: 24px;">${documentName}</span>
              
              <!-- Download Button CTA -->
              <a href="${downloadUrl}" target="_blank" style="display: inline-block; background-color: #f99d1c; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 157, 28, 0.3); transition: all 0.2s ease-in-out;">
                Download Document
              </a>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #64748b; text-align: center; margin-top: 20px;">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${downloadUrl}" style="color: #f99d1c; word-break: break-all; font-size: 13px;">${downloadUrl}</a>
            </p>

            <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 24px; text-align: left;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 4px 0;">Warm regards,</p>
              <p style="color: #11253e; font-weight: 700; font-size: 15px; margin: 0;">The ${resolvedCompanyName} Team</p>
            </div>
          </div>
          
          <!-- Footer Footer -->
          <div style="background-color: #f8fafc; padding: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.15em;">
              © ${new Date().getFullYear()} ${resolvedCompanyName} • All rights reserved
            </p>
          </div>
        </div>
      `
    });

    // 2. Dispatch alert notification email to Admin (company.adminEmail)
    const adminUrl = process.env.ADMIN_URL || 'http://localhost:3000';
    const adminLink = `${adminUrl}/admin/dashboard/document-requests?project=${resolvedProject}`;

    await sendEmail({
      to: adminNotificationEmail,
      fromName: `${resolvedCompanyName} Admin Portal`,
      subject: `[${resolvedCompanyName}] Document Request: ${documentName} by ${name}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; overflow: hidden;">
          <div style="background-color: #11253e; border-bottom: 4px solid #f99d1c; padding: 24px 32px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; tracking: tight;">New Resource Lead Received</h2>
            <span style="font-size: 12px; color: #cbd5e1;">A user has successfully requested and downloaded a gated resource.</span>
          </div>
          
          <div style="padding: 32px; color: #334155;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; width: 140px;">Name</td>
                <td style="padding: 12px 0; color: #11253e; font-weight: 700; font-size: 15px;">${name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Email</td>
                <td style="padding: 12px 0; color: #11253e; font-weight: 600;"><a href="mailto:${email}" style="color: #f99d1c; text-decoration: none;">${email}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Phone</td>
                <td style="padding: 12px 0; color: #11253e;">${phone || 'Not provided'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Document</td>
                <td style="padding: 12px 0; color: #11253e; font-weight: 700;">${documentName}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 32px;">
              <a href="${adminLink}" target="_blank" style="display: inline-block; background-color: #11253e; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
                View on Admin Panel
              </a>
            </div>
          </div>
          
          <div style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0; text-transform: uppercase; tracking: wider;">
              Automated Admin Alert • ${resolvedCompanyName}
            </p>
          </div>
        </div>
      `
    });

    res.status(201).json({ 
      success: true, 
      message: "Request logged. Download instructions have been emailed.", 
      data: newRequest 
    });

  } catch (error) {
    console.error("Document request error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error logging resource request.", 
      details: error.message 
    });
  }
};

// GET ALL DOCUMENT REQUESTS (Admin only, filterable by project)
exports.getAllRequests = async (req, res) => {
  try {
    const { project } = req.query;

    if (!project) {
      return res.status(400).json({ success: false, message: "Project filter is required." });
    }

    // Lookup company
    const company = await Company.findOne({ slug: project.toLowerCase() });
    
    let query = { project: project.toLowerCase() };
    
    // If company exists, include companyId filter to capture both legacy and current models
    if (company) {
      query = {
        $or: [
          { project: project.toLowerCase() },
          { companyId: company._id }
        ]
      };
    }

    const requests = await DocumentRequest.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: requests.length, requests });

  } catch (error) {
    console.error("Error fetching document requests:", error);
    res.status(500).json({ success: false, message: "Server error fetching document requests." });
  }
};

