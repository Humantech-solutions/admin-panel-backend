const Website = require('../models/websiteModel');
const Company = require('../models/companyModel');

// ── helper: generate unique slug ─────────────────────────────────────────────
async function resolveUniqueSlug(base) {
  const slugBase = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  let slug = slugBase;
  let i = 1;
  while (await Website.exists({ slug })) {
    slug = `${slugBase}-${i++}`;
  }
  return slug;
}

// GET ALL WEBSITES FOR A COMPANY
exports.getWebsitesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    let targetCompanyId = companyId;

    if (!companyId.match(/^[0-9a-fA-F]{24}$/)) {
      const company = await Company.findOne({ slug: companyId.toLowerCase() });
      if (company) {
        targetCompanyId = company._id;
      }
    }

    const websites = await Website.find({ companyId: targetCompanyId }).sort({ name: 1 }).lean();
    res.json({ success: true, count: websites.length, websites });
  } catch (error) {
    console.error('Error fetching websites:', error);
    res.status(500).json({ success: false, message: 'Server error fetching websites' });
  }
};

// GET ALL WEBSITES (admin overview)
exports.getAllWebsites = async (req, res) => {
  try {
    const websites = await Website.find()
      .populate('companyId', 'name slug')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, count: websites.length, websites });
  } catch (error) {
    console.error('Error fetching all websites:', error);
    res.status(500).json({ success: false, message: 'Server error fetching websites' });
  }
};

// GET ACTIVE WEBSITES FOR A COMPANY (public)
exports.getActiveWebsitesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const websites = await Website.find({ companyId, isActive: true }).sort({ name: 1 }).lean();
    res.json({ success: true, count: websites.length, websites });
  } catch (error) {
    console.error('Error fetching active websites:', error);
    res.status(500).json({ success: false, message: 'Server error fetching active websites' });
  }
};

// GET SINGLE WEBSITE BY ID OR SLUG
exports.getWebsiteByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let website;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      website = await Website.findById(idOrSlug).populate('companyId', 'name slug').lean();
    } else {
      website = await Website.findOne({ slug: idOrSlug.toLowerCase() })
        .populate('companyId', 'name slug')
        .lean();
    }

    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }

    res.json({ success: true, website });
  } catch (error) {
    console.error('Error fetching website:', error);
    res.status(500).json({ success: false, message: 'Server error fetching website' });
  }
};

// CREATE NEW WEBSITE
exports.createWebsite = async (req, res) => {
  try {
    const { name, slug, url, companyId, isActive } = req.body;
    let rawCompanyId = companyId || req.params.companyId;

    if (!name || !rawCompanyId) {
      return res.status(400).json({ success: false, message: 'Website name and companyId are required' });
    }

    // Verify company exists (by ID or slug)
    let company;
    if (rawCompanyId.match(/^[0-9a-fA-F]{24}$/)) {
      company = await Company.findById(rawCompanyId);
    } else {
      company = await Company.findOne({ slug: rawCompanyId.toLowerCase() });
    }

    if (!company) {
      return res.status(404).json({ success: false, message: 'Parent company not found' });
    }

    const resolvedSlug = await resolveUniqueSlug(slug || name);

    const newWebsite = new Website({
      name,
      slug: resolvedSlug,
      url,
      companyId: company._id,
      isActive: isActive !== undefined ? isActive : true,
    });

    await newWebsite.save();

    res.status(201).json({ success: true, message: 'Website created successfully', website: newWebsite });
  } catch (error) {
    console.error('Error creating website:', error);
    res.status(500).json({ success: false, message: 'Server error during website creation', details: error.message });
  }
};

// UPDATE WEBSITE
exports.updateWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, url, isActive } = req.body;

    const website = await Website.findById(id);
    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }

    if (name) website.name = name;
    if (url !== undefined) website.url = url;
    if (isActive !== undefined) website.isActive = isActive;

    // Handle slug change with conflict check
    if (slug && slug.toLowerCase() !== website.slug) {
      const conflict = await Website.findOne({ slug: slug.toLowerCase() });
      if (conflict) {
        return res.status(400).json({ success: false, message: `Website with slug '${slug}' already exists` });
      }
      website.slug = slug.toLowerCase();
    }

    await website.save();

    res.json({ success: true, message: 'Website updated successfully', website });
  } catch (error) {
    console.error('Error updating website:', error);
    res.status(500).json({ success: false, message: 'Server error during website update', details: error.message });
  }
};

// DELETE WEBSITE
exports.deleteWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const website = await Website.findByIdAndDelete(id);
    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }
    res.json({ success: true, message: 'Website deleted successfully' });
  } catch (error) {
    console.error('Error deleting website:', error);
    res.status(500).json({ success: false, message: 'Server error during website deletion' });
  }
};
