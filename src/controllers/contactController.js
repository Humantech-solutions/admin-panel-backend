const Contact = require('../models/contactModel');
const { sendEmail } = require('../utils/emailUtil');

// SUBMIT CONTACT FORM
exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message, pageTitle, pageUrl, category } = req.body;
    
    const newContact = new Contact({
      name,
      email,
      subject,
      message,
      pageTitle,
      pageUrl,
      category: category
    });

    await newContact.save();
    
    // 1. Send "Thank You" email to the user
    await sendEmail({
      to: email,
      subject: `Thank you for contacting Nabhira Technologies`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px;">
            <h2 style="color: #11253e; margin: 0;">Thank You for Reaching Out!</h2>
          </div>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We have received your message regarding <strong>"${subject || 'General Inquiry'}"</strong>. 
            Thank you for your interest in Nabhira Technologies. 
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Our team is currently reviewing your request and will get back to you as soon as possible. 
            In the meantime, feel free to explore our website to learn more about our services.
          </p>
          
          <div style="margin: 30px 0; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="color: #777; font-size: 14px; margin-bottom: 5px;">Best Regards,</p>
            <p style="color: #11253e; font-weight: bold; font-size: 16px; margin: 0;">The Nabhira Team</p>
            <p style="color: #f99d1c; font-size: 12px; margin-top: 5px;">Innovating for a better tomorrow.</p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #aaa; text-align: center;">This is an automated response. Please do not reply directly to this email.</p>
        </div>
      `
    });

    // 2. Trigger automated notification email to admin
    const adminLink = `http://localhost:3000/admin/dashboard/contact-form${category ? `?category=${encodeURIComponent(category)}` : ""}`;
    
    await sendEmail({
      to: 'deepsikha@hutechsolutions.com',
      subject: `New Lead: User inquiry from ${pageTitle || 'Website'}`,
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
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Subject</td>
              <td style="padding: 10px; color: #11253e;">${subject || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase; vertical-align: top;">Message</td>
              <td style="padding: 10px; color: #11253e; line-height: 1.5;">${message}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; color: #999; font-size: 12px; text-transform: uppercase;">Category</td>
              <td style="padding: 10px; color: #11253e;">${category || 'Website General Form'}</td>
            </tr>
            <tr>
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
          <p style="font-size: 11px; color: #aaa;">This notification was sent automatically from Nabhira CRM.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Contact inquiry submitted successfully" });
  } catch (error) {
    console.error("Contact submission error:", error);
    res.status(500).json({ success: false, message: "Server error during submission" });
  }
};


// GET ALL CONTACTS (with optional category filter)
exports.getAllContacts = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    
    const contacts = await Contact.find(filter).sort({ submittedAt: -1 });
    res.json({ success: true, contacts });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, message: "Server error fetching contacts" });
  }
};

// GET SINGLE CONTACT
exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
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
