const Subscription = require('../models/subscriptionModel');
const { resolveCompanyAndWebsite } = require('../utils/resolverUtil');
const { getHierarchyFilter } = require('../utils/permissionUtil');

exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const resolved = await resolveCompanyAndWebsite(req.body, req);
    
    // Check if already subscribed to this website
    const existing = await Subscription.findOne({ email: email.toLowerCase(), websiteId: resolved.websiteId });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save();
        return res.json({ success: true, message: 'Resubscribed successfully.' });
      }
      return res.status(400).json({ success: false, message: 'Already subscribed.' });
    }

    const newSub = new Subscription({
      email: email.toLowerCase(),
      companyId: resolved.companyId,
      websiteId: resolved.websiteId,
      project: resolved.projectSlug
    });

    await newSub.save();

    // Send Thank You Email
    const { sendEmail } = require('../utils/emailUtil');
    const unsubscribeUrl = `${process.env.BACKEND_URL || 'https://apis.admin.hutechsolutions.in'}/api/subscriptions/unsubscribe?email=${encodeURIComponent(email)}&websiteId=${resolved.websiteId || ''}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #11253e;">Thank you for subscribing!</h2>
        <p>Hi there,</p>
        <p>Thank you for subscribing to ${resolved.companyName} newsletters. We're excited to share our latest updates, insights, and news with you.</p>
        <p>Stay tuned for our upcoming posts!</p>
        
        <hr style="margin-top: 40px; border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #666; text-align: center;">
          You received this email because you subscribed to ${resolved.companyName} newsletters.<br>
          <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Click here to unsubscribe</a>
        </p>
      </div>
    `;

    try {
      await sendEmail({
        to: email,
        fromName: resolved.fromEmailName,
        smtpConfig: resolved.contactSmtp,
        subject: `Welcome to ${resolved.companyName} Newsletters!`,
        html
      });
    } catch (emailErr) {
      console.error('Failed to send subscription welcome email:', emailErr);
    }

    res.status(201).json({ success: true, message: 'Subscribed successfully.' });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ success: false, message: 'Server error.', details: error.message });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const { email, websiteId } = req.query;
    if (!email) return res.status(400).send('Email is required.');

    let query = { email: email.toLowerCase() };
    if (websiteId) {
      query.websiteId = websiteId;
    }
    
    // Hard delete or set isActive = false
    await Subscription.deleteMany(query);
    
    res.send('<html><body><h2>You have successfully unsubscribed.</h2><p>Your details have been removed.</p></body></html>');
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send('Server error processing unsubscription.');
  }
};

exports.getSubscriptions = async (req, res) => {
  try {
    const hierarchyResult = getHierarchyFilter(req, res);
    if (!hierarchyResult.success) return;
    const filter = hierarchyResult.filter;

    const { company, website } = req.query;

    if (website && website !== 'all') {
      const Website = require('../models/websiteModel');
      const foundWeb = await Website.findOne({
        $or: [
          { slug: website.toLowerCase() },
          ...(website.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: website }] : [])
        ]
      }).lean();
      if (foundWeb) filter.websiteId = foundWeb._id;
    }

    if (company && company !== 'all') {
      const Company = require('../models/companyModel');
      const foundComp = await Company.findOne({
        $or: [
          { slug: company.toLowerCase() },
          ...(company.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: company }] : [])
        ]
      }).lean();
      if (foundComp) filter.companyId = foundComp._id;
    }

    const subscriptions = await Subscription.find(filter)
      .populate('companyId', 'name slug')
      .populate('websiteId', 'name slug url')
      .sort({ createdAt: -1 })
      .lean();
      
    res.json({ success: true, count: subscriptions.length, subscriptions });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ success: false, message: "Server error fetching subscriptions." });
  }
};


exports.notifyPublish = async (req, res) => {
  try {
    const { title, url, excerpt, source, websiteId } = req.body;
    if (!title || !url || !websiteId) {
      return res.status(400).json({ success: false, message: 'Missing title, url, or websiteId' });
    }

    const { sendEmail } = require('../utils/emailUtil');
    const Subscription = require('../models/subscriptionModel');
    const Website = require('../models/websiteModel');
    
    const website = await Website.findById(websiteId).populate('companyId');
    if (!website) return res.status(404).json({ success: false, message: 'Website not found' });
    
    const company = website.companyId;

    const subscribers = await Subscription.find({ websiteId, isActive: true });
    
    let sentCount = 0;
    for (const sub of subscribers) {
      const unsubscribeUrl = `${process.env.BACKEND_URL || 'https://apis.admin.hutechsolutions.in'}/api/subscriptions/unsubscribe?email=${sub.email}&websiteId=${websiteId}`;
      
      const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eaeaea;">
        <!-- Header -->
        <div style="background-color: #11253e; padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${company.name}</h1>
          <p style="color: #8fa0b5; margin: 5px 0 0 0; font-size: 14px;">Latest Insights & Updates</p>
        </div>
        
        <!-- Body -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #11253e; margin-top: 0; font-size: 22px; line-height: 1.4;">${title}</h2>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #f99d1c; padding: 15px 20px; margin: 20px 0; color: #475569; font-size: 15px; line-height: 1.6; border-radius: 0 4px 4px 0;">
            ${excerpt || "We just published a new article that we think you'll find interesting. Click below to read the full details and stay updated with our latest industry insights."}
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${url}" style="display: inline-block; padding: 14px 30px; background-color: #f99d1c; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s;">
              Read Full Article
            </a>
          </div>
          
          <!-- Useful Links -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
            <h4 style="color: #11253e; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; text-align: center;">Quick Links</h4>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
              <tr>
                <td width="33%" align="center">
                  <a href="https://hutechsolutions.ai/services" style="color: #2563eb; text-decoration: none; font-weight: 500;">Our Services</a>
                </td>
                <td width="33%" align="center">
                  <a href="https://hutechsolutions.ai/case-studies" style="color: #2563eb; text-decoration: none; font-weight: 500;">Case Studies</a>
                </td>
                <td width="33%" align="center">
                  <a href="https://hutechsolutions.ai/contact" style="color: #2563eb; text-decoration: none; font-weight: 500;">Contact Us</a>
                </td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #eaeaea;">
          <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
            You received this email because you are subscribed to ${company.name} newsletters.<br>
            To stop receiving these emails, <a href="${unsubscribeUrl}" style="color: #f99d1c; text-decoration: underline;">click here to unsubscribe</a>.
          </p>
        </div>
      </div>
      `;
      
      await sendEmail({
        to: sub.email,
        fromName: company.name,
        subject: `New Post: ${title}`,
        html
      });
      sentCount++;
    }

    res.json({ success: true, message: `Notification sent to ${sentCount} subscribers.` });
  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
