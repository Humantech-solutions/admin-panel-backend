const requireEditAccess = (req, res, next) => {
  const role = req.user?.role;
  if (['superadmin', 'company_admin', 'super_editor', 'company_editor'].includes(role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
};

const requireAdminAccess = (req, res, next) => {
  const role = req.user?.role;
  if (['superadmin', 'company_admin'].includes(role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

module.exports = { requireEditAccess, requireAdminAccess };
