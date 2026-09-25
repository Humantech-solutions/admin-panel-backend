/**
 * Generates a MongoDB filter object based on the user's role hierarchy.
 * 
 * - Superadmin: Sees all data (returns empty filter).
 * - Admin / Company Admin: Sees all data for their company (returns { companyId: req.user.companyId }).
 * - User / Viewer: Sees data only for their assigned websites (returns { companyId, websiteId: { $in: req.user.accessibleWebsites } }).
 */
exports.getHierarchyFilter = (req, res) => {
  const filter = {};

  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Frontend roles: "admin", "manager", "viewer"
  // Backend roles: "superadmin", "company_admin", "company_user", "viewer"
  
  if (req.user.role === 'superadmin') {
    // Superadmin has full access, no base filter required.
    return { success: true, filter };
  }

  if (!req.user.companyId) {
    return res.status(400).json({ success: false, message: 'Company account setup required.' });
  }

  filter.companyId = req.user.companyId;

  // If role is company_admin or admin (frontend equivalent), they get full access to the company's data.
  if (req.user.role === 'company_admin' || req.user.role === 'admin') {
    return { success: true, filter };
  }

  // For users / viewers, restrict to explicitly assigned websites.
  if (req.user.accessibleWebsites && req.user.accessibleWebsites.length > 0) {
    filter.websiteId = { $in: req.user.accessibleWebsites };
    return { success: true, filter };
  } else {
    // If a user has no assigned websites, they shouldn't see any data.
    // We force an unmatchable filter.
    filter.websiteId = null; 
    return { success: true, filter };
  }
};
