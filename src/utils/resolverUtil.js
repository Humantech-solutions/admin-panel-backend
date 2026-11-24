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

  // 3. Resolve by string slug/name identifier or URL (project, website, websiteSlug, company, companySlug, url, siteUrl)
  const candidateSlug = (websiteSlug || websiteParam || project || companySlug || companyParam || body.url || body.siteUrl || body.websiteUrl || '').toLowerCase().trim();

  if (candidateSlug && (!company || !website)) {
    // Extract hostname if candidate looks like a URL
    let candidateHost = '';
    try {
      if (candidateSlug.includes('://')) {
        candidateHost = new URL(candidateSlug).hostname.replace(/^www\./, '');
      } else if (candidateSlug.includes('.')) {
        candidateHost = candidateSlug.replace(/^www\./, '').split('/')[0];
      }
    } catch {
      candidateHost = '';
    }

    // Search Website model by slug or url first
    if (!website) {
      const webQuery = [{ slug: candidateSlug }, { url: candidateSlug }];
      if (candidateHost) {
        webQuery.push({ url: { $regex: candidateHost, $options: 'i' } });
      }

      const foundWeb = await Website.findOne({ $or: webQuery }).populate('companyId');
      if (foundWeb) {
        website = foundWeb;
        if (foundWeb.companyId) {
          company = foundWeb.companyId;
        }
      }
    }

    // Search Company model by slug or exact name if company not resolved yet
    if (!company) {
      const cleanRegex = candidateSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      company = await Company.findOne({
        $or: [
          { slug: candidateSlug },
          { name: { $regex: `^${cleanRegex}$`, $options: 'i' } }
        ]
      });
    }
  }

  // 4. Fallback: Parse HTTP Origin or Referer header URL
  if ((!company || !website) && req && req.headers) {
    const originHeader = req.headers.origin || req.headers.referer || '';
    if (originHeader) {
      try {
        const parsedUrl = new URL(originHeader);
        const host = parsedUrl.hostname.replace(/^www\./, '');

        if (!website && !host.includes('localhost') && !host.includes('127.0.0.1')) {
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

  // 6. Global fallback: pick newest active company if nothing matched
  if (!company) {
    company = await Company.findOne({ isActive: true }).sort({ createdAt: -1 });
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

  // Resolve department SMTP credentials with cascading fallback: Website -> Company -> Global
  const websiteSmtp = (website?.smtpConfig?.user && website?.smtpConfig?.pass) ? website.smtpConfig : null;
  const companyAdminSmtp = (company?.adminSmtp?.user && company?.adminSmtp?.pass) ? company.adminSmtp : null;
  const companyCareersSmtp = (company?.careersSmtp?.user && company?.careersSmtp?.pass) ? company.careersSmtp : null;
  const companySalesSmtp = (company?.salesSmtp?.user && company?.salesSmtp?.pass) ? company.salesSmtp : null;
  const companyContactSmtp = (company?.contactSmtp?.user && company?.contactSmtp?.pass) ? company.contactSmtp : null;

  return {
    companyId: company ? company._id : undefined,
    websiteId: website ? website._id : undefined,
    companyName: company ? company.name : 'Default Company',
    websiteName: website ? website.name : undefined,
    adminNotificationEmail: company?.adminEmail || process.env.SMTP_USER,
    careersNotificationEmail: company?.careersNotificationEmail || company?.adminEmail || process.env.SMTP_USER,
    salesNotificationEmail: company?.salesNotificationEmail || company?.adminEmail || process.env.SMTP_USER,
    contactNotificationEmail: company?.contactNotificationEmail || company?.adminEmail || process.env.SMTP_USER,
    fromEmailName: company ? (company.fromEmailName || company.name) : (process.env.SMTP_SENDER_NAME || 'Default Company'),
    projectSlug: candidateSlug || (company ? company.slug : 'default'),
    // Department SMTP configurations (cascading: website -> company department -> company admin -> global)
    adminSmtp: websiteSmtp || companyAdminSmtp || globalSmtp,
    careersSmtp: websiteSmtp || companyCareersSmtp || companyAdminSmtp || globalSmtp,
    salesSmtp: websiteSmtp || companySalesSmtp || companyAdminSmtp || globalSmtp,
    contactSmtp: websiteSmtp || companyContactSmtp || companyAdminSmtp || globalSmtp,
  };
}

module.exports = { resolveCompanyAndWebsite };
