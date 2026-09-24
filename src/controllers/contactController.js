const Contact = require('../models/contactModel');
const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');
const { sendEmail } = require('../utils/emailUtil');
const { resolveCompanyAndWebsite } = require('../utils/resolverUtil');
const { getHierarchyFilter } = require('../utils/permissionUtil');

// SUBMIT CONTACT FORM
exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message, pageTitle, pageUrl, category } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const resolved = await resolveCompanyAndWebsite(req.body, req);
    const resolvedProject = resolved.projectSlug;
    const resolvedCompanyName = resolved.companyName;
    const contactNotificationEmail = resolved.contactNotificationEmail;
    const emailFromName = resolved.fromEmailName;
    const contactSmtp = resolved.contactSmtp;

    const newContact = new Contact({
      name,
      email,
      phone,
      subject: subject || 'General Contact Inquiry',
      message: message || 'Inquiry submitted from website contact form.',
      pageTitle,
      pageUrl,
      category: category || 'Contact',
      companyId: resolved.companyId,
      websiteId: resolved.websiteId
    });

    await newContact.save();
    
    // 1. Send "Thank You" email to the user
    await sendEmail({
      to: email,
      fromName: emailFromName,
      smtpConfig: contactSmtp,
      subject: `Thank you for contacting ${resolvedCompanyName}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px;">
            <h2 style="color: #11253e; margin: 0;">Thank You for Reaching Out!</h2>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We have received your message regarding <strong>"${subject || 'General Inquiry'}"</strong>. 
            Thank you for your interest in ${resolvedCompanyName}. 
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Our team is currently reviewing your request and will get back to you as soon as possible. 
            In the meantime, feel free to explore our website to learn more about our services.
          </p>
          
          <div style="margin: 30px 0; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="color: #777; font-size: 14px; margin-bottom: 5px;">Best Regards,</p>
            <p style="color: #11253e; font-weight: bold; font-size: 16px; margin: 0;">The ${resolvedCompanyName} Team</p>
            <p style="color: #f99d1c; font-size: 12px; margin-top: 5px;">Innovating for a better tomorrow.</p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #aaa; text-align: center;">This is an automated response. Please do not reply directly to this email.</p>
        </div>
      `
    });

    // 2. Trigger automated notification email to admin
    const adminUrl = process.env.ADMIN_URL || 'http://localhost:3000';
    const adminLink = `${adminUrl}/admin/dashboard/contact-form?project=${resolvedProject}${category ? `&category=${encodeURIComponent(category)}` : ""}`;
    
    await sendEmail({
      to: contactNotificationEmail,
      fromName: `${resolvedCompanyName} Admin Portal`,
      smtpConfig: contactSmtp,
      subject: `[${resolvedCompanyName}] New Lead: User inquiry from ${pageTitle || 'Website'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #11253e; border-bottom: 2px solid #f99d1c; padding-bottom: 10px;">New Contact Inquiry Received</h2>
          
          <p style="font-size: 15px; color: #333; margin-bottom: 20px;">
            This user contacted via the <strong>${pageTitle || 'N/A'}</strong> page and wants to know more regarding it.
          </p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase; width: 120px;">Name</td>
              <td style="padding: 10px; color: #11253e; font-weight: bold;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Email</td>
              <td style="padding: 10px; color: #11253e;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Phone</td>
              <td style="padding: 10px; color: #11253e;">${phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Subject</td>
              <td style="padding: 10px; color: #11253e;">${subject || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase; vertical-align: top;">Message</td>
              <td style="padding: 10px; color: #11253e; line-height: 1.5;">${message}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Category</td>
              <td style="padding: 10px; color: #11253e;">${category || 'Website General Form'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Source Page</td>
              <td style="padding: 10px; color: #11253e;">
                <a href="${pageUrl || '#'}" style="color: #f99d1c; text-decoration: none;">${pageTitle || 'Visit Page'}</a>
              </td>
            </tr>
          </table>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${adminLink}" style="background-color: #11253e; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">View in Admin Dashboard</a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #aaa;">This notification was sent automatically from ${resolvedCompanyName} CRM.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Contact inquiry submitted successfully" });
  } catch (error) {
    console.error("Contact submission error:", error);
    res.status(500).json({ success: false, message: "Server error during submission" });
  }
};

// GET ALL CONTACTS (with strict tenant isolation)
exports.getAllContacts = async (req, res) => {
  try {
    const { category, project, company, website } = req.query;
    
    const hierarchyResult = getHierarchyFilter(req, res);
    if (!hierarchyResult.success) return;
    const filter = hierarchyResult.filter;
    
    if (category) filter.category = category;

    // Website-specific filter (within company scope)
    if (website && website !== 'all') {
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
    
    const contacts = await Contact.find(filter)
      .populate('companyId', 'name slug')
      .populate('websiteId', 'name slug url')
      .sort({ submittedAt: -1 })
      .lean();

    res.json({ success: true, contacts });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching contacts" });
  }
};

// GET SINGLE CONTACT
exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).populate('companyId', 'name slug').lean();
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }
    res.json({ success: true, contact });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching contact" });
  }
};

// UPDATE STATUS
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );
    res.json({ success: true, contact });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error updating status" });
  }
};
