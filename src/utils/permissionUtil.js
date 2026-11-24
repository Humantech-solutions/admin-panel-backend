const mongoose = require('mongoose');
const Company = require('../models/companyModel');
const Website = require('../models/websiteModel');

/**
 * Generates a base MongoDB filter object based on the user's role hierarchy.
 * 
 * - Superadmin / Super roles: Sees all data (returns empty filter).
 * - Admin / Company Admin: Sees all data for their company (returns { companyId: req.user.companyId }).
 * - User / Viewer: Sees data only for their assigned websites (returns { companyId, websiteId: { $in: req.user.accessibleWebsites } }).
 */
exports.getHierarchyFilter = (req, res) => {
  const filter = {};

  if (!req.user) {
    return { success: false, statusCode: 401, message: 'Unauthorized' };
  }

  // Frontend roles: "admin", "manager", "viewer"
  // Backend roles: "superadmin", "super_editor", "super_viewer", "company_admin", "company_editor", "company_user", "viewer"

  if (['superadmin', 'super_editor', 'super_viewer'].includes(req.user.role)) {
    // Super roles have full access, no base filter required.
    return { success: true, filter };
  }

  if (!req.user.companyId) {
    return { success: false, statusCode: 400, message: 'Company account setup required.' };
  }

  filter.companyId = req.user.companyId;

  // If role is company_admin or company_editor or admin (frontend equivalent), they get full access to the company's data.
  if (['company_admin', 'company_editor', 'admin'].includes(req.user.role)) {
    return { success: true, filter };
  }

  // For users / viewers, restrict to explicitly assigned websites.
  if (req.user.accessibleWebsites && req.user.accessibleWebsites.length > 0) {
    filter.websiteId = { $in: req.user.accessibleWebsites };
    return { success: true, filter };
  } else {
    // If a user has no assigned websites, they shouldn't see any data.
    filter.websiteId = null;
    return { success: true, filter };
  }
};

/**
 * Helper to escape regex special characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves both role-based hierarchy filters and URL query parameters (company, website, project).
 * Also gracefully matches legacy unassigned documents whose pageUrl or websiteSlug belongs to the resolved company/website.
 */
exports.resolveHierarchyAndScopeFilter = async (req, res) => {
  const hierarchyResult = exports.getHierarchyFilter(req, res);
  if (!hierarchyResult.success) {
    if (res && typeof res.status === 'function') {
      res.status(hierarchyResult.statusCode || 401).json({ success: false, message: hierarchyResult.message });
    }
    return hierarchyResult;
  }

  const filter = { ...hierarchyResult.filter };
  const { company, project, website } = req.query;

  // Determine target company from query (if user is superadmin or specifying company)
  const isSuper = req.user && ['superadmin', 'super_editor', 'super_viewer'].includes(req.user.role);
  const targetCompany = company || (isSuper ? project : undefined);

  let resolvedComp = null;
  if (targetCompany && targetCompany !== 'all') {
    resolvedComp = await Company.findOne({
      $or: [
        { slug: targetCompany.toLowerCase() },
        { name: new RegExp(`^${escapeRegex(targetCompany)}$`, 'i') },
        ...(mongoose.Types.ObjectId.isValid(targetCompany) ? [{ _id: targetCompany }] : [])
      ]
    }).lean();

    if (resolvedComp) {
      filter.companyId = resolvedComp._id;
    } else {
      // Company requested but does not exist -> return non-matching filter
      filter.companyId = new mongoose.Types.ObjectId();
      return { success: true, filter };
    }
  } else if (filter.companyId) {
    resolvedComp = await Company.findById(filter.companyId).lean();
  }

  // Determine target website from query
  const targetWebsite = website || (targetCompany && targetCompany !== 'all' ? undefined : project);
  let resolvedWeb = null;

  if (targetWebsite && targetWebsite !== 'all') {
    resolvedWeb = await Website.findOne({
      $or: [
        { slug: targetWebsite.toLowerCase() },
        { name: new RegExp(`^${escapeRegex(targetWebsite)}$`, 'i') },
        ...(mongoose.Types.ObjectId.isValid(targetWebsite) ? [{ _id: targetWebsite }] : [])
      ]
    }).lean();

    if (resolvedWeb) {
      filter.websiteId = resolvedWeb._id;
    } else {
      // Website requested but does not exist -> return non-matching filter
      filter.websiteId = new mongoose.Types.ObjectId();
      return { success: true, filter };
    }
  }

  // 3. Graceful fallback for legacy records:
  // If documents were created before companyId/websiteId were populated,
  // allow matching by pageUrl / pageTitle containing the company or website domains.
  if (resolvedWeb) {
    const rawUrl = (resolvedWeb.url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim();
    const webSlug = resolvedWeb.slug || '';

    const patterns = [];
    if (rawUrl) patterns.push(new RegExp(escapeRegex(rawUrl), 'i'));
    if (webSlug && webSlug.length >= 3 && !['all', 'com', 'org', 'net'].includes(webSlug)) {
      patterns.push(new RegExp(escapeRegex(webSlug), 'i'));
    }

    if (patterns.length > 0) {
      filter.$or = [
        { websiteId: resolvedWeb._id },
        {
          websiteId: { $in: [null, undefined] },
          $or: [
            ...patterns.map(p => ({ pageUrl: p })),
            ...patterns.map(p => ({ pageTitle: p }))
          ]
        }
      ];
      delete filter.websiteId;
      delete filter.companyId;
    }
  } else if (resolvedComp) {
    const compWebsites = await Website.find({ companyId: resolvedComp._id }).lean();
    const webIds = compWebsites.map(w => w._id);

    const domainPatterns = [];
    compWebsites.forEach(w => {
      if (w.url) {
        const dom = w.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim();
        if (dom) domainPatterns.push(new RegExp(escapeRegex(dom), 'i'));
      }
      if (w.slug && w.slug.length >= 3) {
        domainPatterns.push(new RegExp(escapeRegex(w.slug), 'i'));
      }
    });

    if (resolvedComp.slug && resolvedComp.slug.length >= 3) {
      domainPatterns.push(new RegExp(escapeRegex(resolvedComp.slug), 'i'));
    }
    if (resolvedComp.name && resolvedComp.name.length >= 3) {
      domainPatterns.push(new RegExp(escapeRegex(resolvedComp.name), 'i'));
    }

    filter.$or = [
      { companyId: resolvedComp._id },
      ...(webIds.length > 0 ? [{ websiteId: { $in: webIds } }] : []),
      ...(domainPatterns.length > 0 ? [{
        companyId: { $in: [null, undefined] },
        $or: [
          ...domainPatterns.map(p => ({ pageUrl: p })),
          ...domainPatterns.map(p => ({ pageTitle: p }))
        ]
      }] : [])
    ];
    delete filter.companyId;
  }

  return { success: true, filter, company: resolvedComp, website: resolvedWeb };
};
