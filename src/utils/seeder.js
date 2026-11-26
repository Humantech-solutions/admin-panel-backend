const User = require('../models/userModel');
const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');
const Career = require('../models/careerModel');
const Contact = require('../models/contactModel');
const bcrypt = require('bcryptjs');

/**
 * Backfills companyId and websiteId on legacy/unlinked documents
 * (e.g. documents created before multi-tenancy or without explicit companyId).
 */
async function backfillUnassignedRecords() {
  try {
    const companies = await Company.find({}).lean();
    const websites = await Website.find({}).lean();

    if (companies.length === 0) return;

    // Helper to find best company and website for a given URL / slug
    function matchCompanyAndWebsite(pageUrl, websiteSlug) {
      const urlLower = (pageUrl || '').toLowerCase();
      const slugLower = (websiteSlug || '').toLowerCase();

      // First check websites
      for (const web of websites) {
        const webSlug = (web.slug || '').toLowerCase();
        const webUrl = (web.url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

        if ((webSlug && slugLower === webSlug) || (webUrl && urlLower.includes(webUrl))) {
          return { companyId: web.companyId, websiteId: web._id };
        }
      }

      // Check companies directly
      for (const comp of companies) {
        const compSlug = (comp.slug || '').toLowerCase();
        const compName = (comp.name || '').toLowerCase();

        if ((compSlug && slugLower === compSlug) || (compSlug && urlLower.includes(compSlug)) || (compName && urlLower.includes(compName.replace(/\s+/g, '')))) {
          // Find first website under this company if any
          const web = websites.find(w => String(w.companyId) === String(comp._id));
          return { companyId: comp._id, websiteId: web ? web._id : undefined };
        }
      }

      // Default to first company if only one company exists
      if (companies.length === 1) {
        const singleComp = companies[0];
        const web = websites.find(w => String(w.companyId) === String(singleComp._id));
        return { companyId: singleComp._id, websiteId: web ? web._id : undefined };
      }

      return null;
    }

    const validCompanyIds = (await Company.find({}, '_id')).map(c => c._id);

    // 1. Backfill Careers
    const unlinkedCareers = await Career.find({
      $or: [
        { companyId: null },
        { companyId: { $exists: false } },
        { companyId: { $nin: validCompanyIds } }
      ]
    });

    if (unlinkedCareers.length > 0) {
      console.log(`🔍 Found ${unlinkedCareers.length} unlinked Career applications. Linking to companies...`);
      for (const item of unlinkedCareers) {
        const match = matchCompanyAndWebsite(item.pageUrl, item.websiteSlug);
        if (match) {
          item.companyId = match.companyId;
          if (match.websiteId && !item.websiteId) item.websiteId = match.websiteId;
          await item.save();
        }
      }
      console.log(`✅ Career applications backfilled successfully.`);
    }

    // 2. Backfill Contacts
    const unlinkedContacts = await Contact.find({
      $or: [
        { companyId: null },
        { companyId: { $exists: false } },
        { companyId: { $nin: validCompanyIds } }
      ]
    });

    if (unlinkedContacts.length > 0) {
      console.log(`🔍 Found ${unlinkedContacts.length} unlinked Contact inquiries. Linking to companies...`);
      for (const item of unlinkedContacts) {
        const match = matchCompanyAndWebsite(item.pageUrl, item.websiteSlug);
        if (match) {
          item.companyId = match.companyId;
          if (match.websiteId && !item.websiteId) item.websiteId = match.websiteId;
          await item.save();
        }
      }
      console.log(`✅ Contact inquiries backfilled successfully.`);
    }
  } catch (err) {
    console.warn('⚠️ Backfill warning (safe to ignore):', err.message);
  }
}

/**
 * Seeds default initial Superadmin data on server startup.
 * Idempotent — safe to run on every server start.
 */
async function seedDefaults() {
  try {
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
    const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Super Admin';

    // 1. Delete legacy superadmin emails explicitly: do not keep admin@hutechsolutions.in or old pravat@hutechsolutions.com
    await User.deleteMany({ email: { $in: ['admin@hutechsolutions.in', 'pravat@hutechsolutions.com'] } });

    // 2. Ensure superadmin exists with secure credentials from environment variables
    if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD) {
      const cleanEmail = SUPERADMIN_EMAIL.toLowerCase().trim();
      const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
      let superAdmin = await User.findOne({ email: cleanEmail });

      if (!superAdmin) {
        console.log(`🌱 Seeding default Superadmin user (${cleanEmail})...`);
        await User.create({
          name: SUPERADMIN_NAME,
          email: cleanEmail,
          password: hashedPassword,
          role: 'superadmin',
          companyId: null,
          mfaEnabled: false,
          status: 'active',
          inviteAccepted: true,
          mustChangePassword: false,
        });
        console.log('✅ Default Superadmin seeded successfully!');
      } else {
        superAdmin.password = hashedPassword;
        superAdmin.role = 'superadmin';
        superAdmin.companyId = null;
        superAdmin.status = 'active';
        superAdmin.inviteAccepted = true;
        superAdmin.mustChangePassword = false;
        await superAdmin.save();
      }
    }

    // 3. Ensure already onboarded users who completed password change remain active
    await User.updateMany(
      {
        mustChangePassword: false,
        status: { $ne: 'inactive' }
      },
      {
        $set: { status: 'active', inviteAccepted: true }
      }
    );

    // Run backfill for any legacy unlinked documents
    await backfillUnassignedRecords();
  } catch (err) {
    console.error('❌ Seeder error:', err.message);
  }
}

module.exports = seedDefaults;
