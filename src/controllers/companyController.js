const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const otplib = require('otplib');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailUtil');
const { encrypt } = require('../utils/cryptoUtil');
const { generateEmbedDetails } = require('../utils/embedUtil');

// ── helper: sanitize company output (mask SMTP passwords) ────────────────────
function sanitizeCompany(company) {
  if (!company) return company;
  const doc = company.toObject ? company.toObject() : JSON.parse(JSON.stringify(company));
  ['adminSmtp', 'careersSmtp', 'salesSmtp', 'contactSmtp'].forEach((key) => {
    if (doc[key]) {
      doc[key].isConfigured = Boolean(doc[key].user && doc[key].pass);
      doc[key].pass = doc[key].pass ? '••••••••' : undefined;
    }
  });
  return doc;
}

// ── helper: format & encrypt SMTP payload ────────────────────────────────────
function formatSmtpForSave(newSmtp, existingSmtp) {
  if (!newSmtp) return undefined;
  let pass = newSmtp.pass;
  if (!pass || pass === '••••••••') {
    pass = existingSmtp?.pass;
  } else {
    pass = encrypt(pass);
  }
  return {
    host: newSmtp.host?.trim() || undefined,
    port: newSmtp.port ? Number(newSmtp.port) : undefined,
    user: newSmtp.user?.trim() || undefined,
    pass,
    secure: Boolean(newSmtp.secure),
  };
}

// ── helper: generate unique slug ─────────────────────────────────────────────
async function resolveUniqueSlug(base, Model) {
  const slugBase = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  let slug = slugBase;
  let i = 1;
  while (await Model.exists({ slug })) {
    slug = `${slugBase}-${i++}`;
  }
  return slug;
}

// GET ALL COMPANIES
exports.getAllCompanies = async (req, res) => {
  try {
    const isSuperRole = ['superadmin', 'super_editor', 'super_viewer'].includes(req.user.role);
    const query = isSuperRole ? {} : { _id: req.user.companyId };
    const companies = await Company.find(query).sort({ name: 1 }).lean();
    const companiesWithWebsites = await Promise.all(
      companies.map(async (company) => {
        const websites = await Website.find({ companyId: company._id }).sort({ createdAt: -1 }).lean();
        return { ...company, websites };
      })
    );
    res.json({ 
      success: true, 
      count: companiesWithWebsites.length, 
      companies: companiesWithWebsites.map(c => sanitizeCompany(c)) 
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success: false, message: 'Server error fetching companies' });
  }
};

// GET ACTIVE COMPANIES ONLY (for public/dropdown lists)
exports.getActiveCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ 
      success: true, 
      count: companies.length, 
      companies: companies.map(c => sanitizeCompany(c)) 
    });
  } catch (error) {
    console.error('Error fetching active companies:', error);
    res.status(500).json({ success: false, message: 'Server error fetching active companies' });
  }
};

// GET SINGLE COMPANY BY ID OR SLUG
exports.getCompanyByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let company;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      company = await Company.findById(idOrSlug).lean();
    } else {
      company = await Company.findOne({ slug: idOrSlug.toLowerCase() }).lean();
    }

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({ success: true, company: sanitizeCompany(company) });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ success: false, message: 'Server error fetching company details' });
  }
};

// CREATE NEW COMPANY
// If siteUrl (+ optional siteName) are provided, automatically creates a linked Website.
exports.createCompany = async (req, res) => {
  try {
    const { 
      name, 
      slug, 
      description, 
      adminEmail, 
      careersNotificationEmail,
      salesNotificationEmail,
      contactNotificationEmail,
      fromEmailName, 
      siteUrl, 
      siteName,
      adminSmtp,
      careersSmtp,
      salesSmtp,
      contactSmtp
    } = req.body;

    if (!name || !adminEmail) {
      return res.status(400).json({ success: false, message: 'Company name and notification email are required' });
    }

    const resolvedSlug = await resolveUniqueSlug(slug || name, Company);

    const existingCompany = await Company.findOne({ slug: resolvedSlug });
    if (existingCompany) {
      return res.status(400).json({ success: false, message: `Company with slug '${resolvedSlug}' already exists.` });
    }

    const newCompany = new Company({
      name,
      slug: resolvedSlug,
      description,
      adminEmail,
      careersNotificationEmail,
      salesNotificationEmail,
      contactNotificationEmail,
      fromEmailName,
      ...(adminSmtp && { adminSmtp: formatSmtpForSave(adminSmtp) }),
      ...(careersSmtp && { careersSmtp: formatSmtpForSave(careersSmtp) }),
      ...(salesSmtp && { salesSmtp: formatSmtpForSave(salesSmtp) }),
      ...(contactSmtp && { contactSmtp: formatSmtpForSave(contactSmtp) }),
    });

    await newCompany.save();

    // Auto-create a linked Website if a siteUrl was provided
    let autoWebsite = null;
    if (siteUrl) {
      const websiteSlug = await resolveUniqueSlug(siteName || name, Website);
      autoWebsite = await Website.create({
        name: siteName || name,
        slug: websiteSlug,
        url: siteUrl,
        companyId: newCompany._id,
        isActive: true,
      });
    }

    // Auto-create Company Admin User Account if adminEmail does not exist as user
    let adminUser = await User.findOne({ email: adminEmail.toLowerCase() });
    let tempPassword = null;

    if (!adminUser) {
      tempPassword = `Pass#${crypto.randomBytes(4).toString('hex')}!`;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Generate Google Authenticator secret & QR Code for the company admin
      const mfaSecret = otplib.generateSecret();
      const serviceName = process.env.MFA_SERVICE_NAME || `${name} Admin`;
      const cleanEmail = adminEmail.toLowerCase().trim();
      const otpauth = `otpauth://totp/${encodeURIComponent(serviceName)}:${encodeURIComponent(cleanEmail)}?secret=${mfaSecret}&issuer=${encodeURIComponent(serviceName)}`;
      const qrCodeUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'H', margin: 4, width: 300 });

      adminUser = await User.create({
        name: fromEmailName || `${name} Admin`,
        email: cleanEmail,
        password: hashedPassword,
        role: 'company_admin',
        companyId: newCompany._id,
        mfaSecret,
        mfaEnabled: true,
        mustChangePassword: true,
      });

      // Email credentials & embedded Google Authenticator QR Code
      const loginUrl = `${process.env.ADMIN_URL || 'https://admin.hutechsolutions.ai'}/login`;
      try {
        await sendEmail({
          to: cleanEmail,
          fromName: `Hutech CRM`,
          smtpConfig: null, // Always sent via Platform/Superadmin SMTP engine
          subject: `Welcome to ${name} Admin Portal — Credentials & Google Authenticator Setup`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 30px auto; padding: 0; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); color: #11253e;">
              <div style="background: linear-gradient(135deg, #11253e 0%, #1a385c 100%); padding: 36px 32px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Welcome to ${name}</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">Company Admin Access &amp; Two-Factor Security Setup</p>
              </div>

              <div style="padding: 32px;">
                <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
                  An organization portal for <strong>${name}</strong> has been provisioned. Below are your administrator credentials and your <strong>Google Authenticator QR Code</strong> to activate Two-Factor Authentication (2FA).
                </p>

                <!-- Credentials Box -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                  <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Administrator Credentials</p>
                  <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Login Email:</strong> <span style="color: #11253e;">${cleanEmail}</span></p>
                  <p style="margin: 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="font-family: monospace; font-size: 16px; font-weight: bold; color: #f99d1c; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${tempPassword}</code></p>
                </div>

                <!-- Google Authenticator QR Scanner Box -->
                <div style="background: #ffffff; border: 2px solid #f1f5f9; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: inline-block; background: #f99d1c; color: white; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px;">Step 1: Scan with Google Authenticator</div>
                  <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #11253e;">Set Up Two-Factor Authentication</h3>
                  <p style="margin: 0 0 18px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                    Open the <strong>Google Authenticator</strong> app on your mobile device, tap <strong>+ (Add)</strong>, and scan the QR code:
                  </p>
                  
                  <div style="display: inline-block; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 16px;">
                    <img src="cid:qrcode" alt="Google Authenticator QR Code" width="220" height="220" style="display: block; border-radius: 8px;" />
                  </div>

                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">Manual Setup Key:</p>
                  <div style="font-family: monospace; font-size: 18px; font-weight: 700; color: #11253e; background: #f8fafc; padding: 8px 16px; border: 1px dashed #cbd5e1; border-radius: 8px; display: inline-block; letter-spacing: 4px;">
                    ${mfaSecret}
                  </div>
                </div>

                <!-- Website Embed Code Snippet -->
                <div style="background: #0f172a; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                  <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Your Website Embed Code</p>
                  <pre style="margin: 0; color: #38bdf8; font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all;">&lt;script src="${process.env.BACKEND_URL || 'https://apis.admin.hutechsolutions.in'}/crm-embed.js" data-website="${autoWebsite ? autoWebsite.slug : resolvedSlug}" async&gt;&lt;/script&gt;</pre>
                </div>

                <!-- CTA -->
                <div style="text-align: center; margin-bottom: 16px;">
                  <a href="${loginUrl}" style="display: inline-block; background: #f99d1c; color: white; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Login to Admin Portal &rarr;</a>
                </div>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: 'qrcode.png',
              content: qrCodeUrl.split('base64,')[1],
              encoding: 'base64',
              cid: 'qrcode'
            }
          ]
        });
      } catch (emailErr) {
        console.warn("Welcome email notification warning:", emailErr.message);
      }
    }

    const targetSlug = autoWebsite ? autoWebsite.slug : resolvedSlug;
    const embed = generateEmbedDetails(targetSlug, req);

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company: newCompany,
      ...(autoWebsite && { website: autoWebsite }),
      ...(tempPassword && { tempPassword }),
      embed,
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ success: false, message: 'Server error during company creation', details: error.message });
  }
};

// UPDATE COMPANY
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      slug, 
      description, 
      adminEmail, 
      careersNotificationEmail,
      salesNotificationEmail,
      contactNotificationEmail,
      fromEmailName, 
      isActive,
      adminSmtp,
      careersSmtp,
      salesSmtp,
      contactSmtp
    } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (name) company.name = name;
    if (description !== undefined) company.description = description;
    if (adminEmail) company.adminEmail = adminEmail;
    if (careersNotificationEmail !== undefined) company.careersNotificationEmail = careersNotificationEmail;
    if (salesNotificationEmail !== undefined) company.salesNotificationEmail = salesNotificationEmail;
    if (contactNotificationEmail !== undefined) company.contactNotificationEmail = contactNotificationEmail;
    if (fromEmailName !== undefined) company.fromEmailName = fromEmailName;
    if (isActive !== undefined) company.isActive = isActive;

    if (adminSmtp !== undefined) company.adminSmtp = formatSmtpForSave(adminSmtp, company.adminSmtp);
    if (careersSmtp !== undefined) company.careersSmtp = formatSmtpForSave(careersSmtp, company.careersSmtp);
    if (salesSmtp !== undefined) company.salesSmtp = formatSmtpForSave(salesSmtp, company.salesSmtp);
    if (contactSmtp !== undefined) company.contactSmtp = formatSmtpForSave(contactSmtp, company.contactSmtp);

    // Check if new slug conflicts with another company
    if (slug && slug.toLowerCase() !== company.slug) {
      const slugConflict = await Company.findOne({ slug: slug.toLowerCase() });
      if (slugConflict) {
        return res.status(400).json({ success: false, message: `Company with slug '${slug}' already exists.` });
      }
      company.slug = slug.toLowerCase();
    }

    await company.save();

    res.json({ success: true, message: 'Company updated successfully', company: sanitizeCompany(company) });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ success: false, message: 'Server error during company update', details: error.message });
  }
};

// DELETE COMPANY
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findByIdAndDelete(id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ success: false, message: 'Server error during company deletion' });
  }
};
