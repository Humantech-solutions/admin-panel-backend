const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

/**
 * Seeds default initial Superadmin data on server startup.
 * Idempotent — safe to run on every server start.
 * Does NOT seed or delete any companies or websites.
 */
async function seedDefaults() {
  try {
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@hutechsolutions.in';
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Admin@123456';
    const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Super Admin';

    let superAdmin = await User.findOne({ email: SUPERADMIN_EMAIL });

    if (!superAdmin) {
      console.log(`🌱 Seeding default Superadmin user (${SUPERADMIN_EMAIL})...`);
      const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
      await User.create({
        name: SUPERADMIN_NAME,
        email: SUPERADMIN_EMAIL,
        password: hashedPassword,
        role: 'superadmin',
        companyId: null,
        mfaEnabled: false,
      });
      console.log('✅ Default Superadmin seeded successfully!');
    }
  } catch (err) {
    console.error('❌ Seeder error:', err.message);
  }
}

module.exports = seedDefaults;
