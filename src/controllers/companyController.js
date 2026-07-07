const Company = require('../models/companyModel');

// GET ALL COMPANIES
exports.getAllCompanies = async (req, res) => {
  try {
    // Sort by name, return lightweight lean objects
    const companies = await Company.find().sort({ name: 1 }).lean();
    res.json({ success: true, count: companies.length, companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ success: false, message: "Server error fetching companies" });
  }
};

// GET ACTIVE COMPANIES ONLY (for public/dropdown lists)
exports.getActiveCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ success: true, count: companies.length, companies });
  } catch (error) {
    console.error("Error fetching active companies:", error);
    res.status(500).json({ success: false, message: "Server error fetching active companies" });
  }
};

// GET SINGLE COMPANY BY ID OR SLUG
exports.getCompanyByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let company;
    
    // Check if ID is a valid MongoDB ObjectId
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      company = await Company.findById(idOrSlug).lean();
    } else {
      company = await Company.findOne({ slug: idOrSlug.toLowerCase() }).lean();
    }

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.json({ success: true, company });
  } catch (error) {
    console.error("Error fetching company details:", error);
    res.status(500).json({ success: false, message: "Server error fetching company details" });
  }
};

// CREATE NEW COMPANY
exports.createCompany = async (req, res) => {
  try {
    const { name, slug, description, siteUrl, adminEmail, fromEmailName } = req.body;

    if (!name || !adminEmail) {
      return res.status(400).json({ success: false, message: "Company name and notification email are required" });
    }

    // Auto-generate slug from name if not provided
    const resolvedSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    // Check if company already exists
    const existingCompany = await Company.findOne({ slug: resolvedSlug });
    if (existingCompany) {
      return res.status(400).json({ success: false, message: `Company with slug '${resolvedSlug}' already exists.` });
    }

    const newCompany = new Company({
      name,
      slug: resolvedSlug,
      description,
      siteUrl,
      adminEmail,
      fromEmailName
    });

    await newCompany.save();

    res.status(201).json({ success: true, message: "Company created successfully", company: newCompany });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ success: false, message: "Server error during company creation", details: error.message });
  }
};

// UPDATE COMPANY
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, siteUrl, adminEmail, fromEmailName, isActive } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    if (name) company.name = name;
    if (description !== undefined) company.description = description;
    if (siteUrl !== undefined) company.siteUrl = siteUrl;
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

    res.json({ success: true, message: "Company updated successfully", company });
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({ success: false, message: "Server error during company update", details: error.message });
  }
};

// DELETE COMPANY
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findByIdAndDelete(id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ success: false, message: "Server error during company deletion" });
  }
};
