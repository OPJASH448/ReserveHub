require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const SuperAdmin = require('../src/models/SuperAdmin');

const seedSuperAdmin = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/strata';
  console.log(`Connecting to database at ${uri}...`);
  await mongoose.connect(uri);

  const email = process.env.SUPERADMIN_EMAIL || 'admin@strata.com';
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperSecretAdmin123!';

  const existing = await SuperAdmin.findOne({ email });
  if (existing) {
    console.log('SuperAdmin already exists.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = new SuperAdmin({
    name: 'SuperAdmin',
    email,
    passwordHash
  });

  await admin.save();
  console.log(`SuperAdmin seeded successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  process.exit(0);
};

seedSuperAdmin().catch(err => {
  console.error('Error seeding SuperAdmin:', err);
  process.exit(1);
});
