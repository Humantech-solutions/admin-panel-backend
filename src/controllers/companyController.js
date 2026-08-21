const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailUtil');

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
    const companies = await Company.find().sort({ name: 1 }).lean();
    const companiesWithWebsites = await Promise.all(
      companies.map(async (company) => {
        const websites = await Website.find({ companyId: company._id }).sort({ createdAt: -1 }).lean();
        return { ...company, websites };
      })
    );
    res.json({ success: true, count: companiesWithWebsites.length, companies: companiesWithWebsites });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ success: false, message: 'Server error fetching companies' });
  }
};

// GET ACTIVE COMPANIES ONLY (for public/dropdown lists)
exports.getActiveCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ success: true, count: companies.length, companies });
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

    res.json({ success: true, company });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ success: false, message: 'Server error fetching company details' });
  }
};

// CREATE NEW COMPANY
// If siteUrl (+ optional siteName) are provided, automatically creates a linked Website.
exports.createCompany = async (req, res) => {
  try {
    const { name, slug, description, adminEmail, fromEmailName, siteUrl, siteName } = req.body;

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
      fromEmailName,
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

      adminUser = await User.create({
        name: fromEmailName || `${name} Admin`,
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        role: 'company_admin',
        companyId: newCompany._id,
        mfaEnabled: false,
        mustChangePassword: true,
      });

      // Email temporary credentials & login URL to company admin
      try {
        await sendEmail({
          to: adminEmail,
          subject: `Welcome to ${name} Admin Portal — Credentials & Login Link`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 16px; color: #11253e; box-shadow: 0 4px 24px rgba(0,0,0,0.05);">
              <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 12px;">Organization Onboarded Successfully</h2>
              <p style="color: #64748b; font-size: 15px; margin-bottom: 24px;">An organization portal for <strong>${name}</strong> has been provisioned.</p>

              <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Login Email:</strong> ${adminEmail}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="font-size: 18px; color: #f99d1c; font-weight: bold;">${tempPassword}</code></p>
              </div>

              <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Upon first login, you will set up 2FA and be prompted to update your password.</p>

              <a href="http://localhost:3000/login" style="display: inline-block; background: #f99d1c; color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Login to Admin Portal</a>
            </div>
          `
        });
      } catch (emailErr) {
        console.warn("Welcome email notification warning:", emailErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company: newCompany,
      ...(autoWebsite && { website: autoWebsite }),
      ...(tempPassword && { tempPassword }),
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
    const { name, slug, description, adminEmail, fromEmailName, isActive } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (name) company.name = name;
    if (description !== undefined) company.description = description;
    if (adminEmail) company.adminEmail = adminEmail;
    if (fromEmailName !== undefined) company.fromEmailName = fromEmailName;
    if (isActive !== undefined) company.isActive = isActive;

    // Check if new slug conflicts with another company
    if (slug && slug.toLowerCase() !== company.slug) {
      const slugConflict = await Company.findOne({ slug: slug.toLowerCase() });
      if (slugConflict) {
        return res.status(400).json({ success: false, message: `Company with slug '${slug}' already exists.` });
      }
      company.slug = slug.toLowerCase();
    }

    await company.save();

    res.json({ success: true, message: 'Company updated successfully', company });
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
