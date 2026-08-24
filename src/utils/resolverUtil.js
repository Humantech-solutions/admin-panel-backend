const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');

/**
 * Automatically resolves `companyId` and `websiteId` ObjectIds 
 * from incoming POST payloads or HTTP origin/referer headers.
 * 
 * Works seamlessly without requiring client website frontends to know MongoDB ObjectIds.
 */
async function resolveCompanyAndWebsite(body = {}, req = {}) {
  let company = null;
  let website = null;

  const {
    companyId,
    websiteId,
    websiteSlug,
    website: websiteParam,
    project,
    company: companyParam,
    companySlug
  } = body;

  // 1. Check direct websiteId (if valid ObjectId)
  if (websiteId && String(websiteId).match(/^[0-9a-fA-F]{24}$/)) {
    website = await Website.findById(websiteId).populate('companyId');
    if (website && website.companyId) {
      company = website.companyId;
    }
  }

  // 2. Check direct companyId (if valid ObjectId and not found yet)
  if (!company && companyId && String(companyId).match(/^[0-9a-fA-F]{24}$/)) {
    company = await Company.findById(companyId);
  }

  // 3. Resolve by string slug/name identifier (project, website, websiteSlug, company, companySlug)
  const candidateSlug = (websiteSlug || websiteParam || project || companySlug || companyParam || '').toLowerCase().trim();

  if (candidateSlug && (!company || !website)) {
    // Search Website model by slug first
    if (!website) {
      const foundWeb = await Website.findOne({ slug: candidateSlug }).populate('companyId');
      if (foundWeb) {
        website = foundWeb;
        if (foundWeb.companyId) {
          company = foundWeb.companyId;
        }
      }
    }

    // Search Company model by slug if company not resolved yet
    if (!company) {
      company = await Company.findOne({ slug: candidateSlug });
    }
  }

  // 4. Fallback: Parse HTTP Origin or Referer header URL
  if ((!company || !website) && req && req.headers) {
    const originHeader = req.headers.origin || req.headers.referer || '';
    if (originHeader) {
      try {
        const parsedUrl = new URL(originHeader);
        const host = parsedUrl.hostname.replace(/^www\./, '');

        if (!website) {
          const matchedWeb = await Website.findOne({
            $or: [
              { url: { $regex: host, $options: 'i' } },
              { slug: { $regex: host.split('.')[0], $options: 'i' } }
            ]
          }).populate('companyId');

          if (matchedWeb) {
            website = matchedWeb;
            if (matchedWeb.companyId) {
              company = matchedWeb.companyId;
            }
          }
        }
      } catch (err) {
        // Invalid origin header string, skip
      }
    }
  }

  // 5. If company resolved but website missing, pick default active website for that company
  if (company && !website) {
    website = await Website.findOne({ companyId: company._id, isActive: true });
  }

  // 6. Global fallback: pick first active company if nothing matched
  if (!company) {
    company = await Company.findOne({ isActive: true }).sort({ createdAt: 1 });
    if (company && !website) {
      website = await Website.findOne({ companyId: company._id, isActive: true });
    }
  }

  // Define global fallback SMTP configuration from environment variables
  const globalSmtp = process.env.SMTP_USER ? {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : null;

  return {
    companyId: company ? company._id : undefined,
    websiteId: website ? website._id : undefined,
    companyName: company ? company.name : 'Default Company',
    websiteName: website ? website.name : undefined,
    adminNotificationEmail: company ? company.adminEmail : 'trupti@hutechsolutions.com',
    careersNotificationEmail: company?.careersNotificationEmail || company?.careersSmtp?.user || company?.adminEmail || 'trupti@hutechsolutions.com',
    salesNotificationEmail: company?.salesNotificationEmail || company?.salesSmtp?.user || company?.adminEmail || 'trupti@hutechsolutions.com',
    contactNotificationEmail: company?.contactNotificationEmail || company?.contactSmtp?.user || company?.adminEmail || 'trupti@hutechsolutions.com',
    fromEmailName: company ? (company.fromEmailName || company.name) : 'Hutech Solutions',
    projectSlug: candidateSlug || (company ? company.slug : 'hutech'),
    // Department SMTP configurations (defaulting to global email setup if not custom-configured)
    adminSmtp: company?.adminSmtp?.user ? company.adminSmtp : globalSmtp,
    careersSmtp: company?.careersSmtp?.user ? company.careersSmtp : globalSmtp,
    salesSmtp: company?.salesSmtp?.user ? company.salesSmtp : globalSmtp,
    contactSmtp: company?.contactSmtp?.user ? company.contactSmtp : globalSmtp,
  };
}

module.exports = { resolveCompanyAndWebsite };
