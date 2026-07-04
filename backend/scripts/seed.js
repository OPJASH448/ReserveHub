#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const SuperAdmin = require('../src/models/SuperAdmin');
const Org = require('../src/models/Org');
const RoleLevel = require('../src/models/RoleLevel');
const User = require('../src/models/User');
const Resource = require('../src/models/Resource');

// Seed data that will be inserted if database is empty
const seedData = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/strata';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const orgCount = await Org.countDocuments();
    const userCount = await User.countDocuments();
    const resourceCount = await Resource.countDocuments();
    
    console.log('\n=== DATABASE STATE ===');
    console.log('Orgs:', orgCount);
    console.log('Users:', userCount);
    console.log('Resources:', resourceCount);
    
    // Only seed if database is empty
    if (orgCount === 0 || userCount < 4 || resourceCount === 0) {
      console.log('\nDatabase needs seeding. Running seed...');
      
      try {
        // 1. SuperAdmin
        const saHash = await bcrypt.hash('SuperSecretAdmin123!', 10);
        const superAdmin = await SuperAdmin.create({
          name: 'Super Admin',
          email: 'admin@strata.com',
          passwordHash: saHash
        });
        console.log('Seed: SuperAdmin created (admin@strata.com / SuperSecretAdmin123!)');

        // 2. IIT Madras org (active so users can sign up)
        const org = await Org.create({
          name: 'IIT Madras',
          type: 'Educational Institute',
          status: 'active',
          createdBy: superAdmin._id
        });
        console.log('Seed: Org "IIT Madras" created');

        // 3. Role levels
        const orgAdminRole = await RoleLevel.create({ orgId: org._id, name: 'OrgAdmin', rank: 0, parentRoleLevelId: null });
        const facultyRole = await RoleLevel.create({ orgId: org._id, name: 'Faculty', rank: 1, parentRoleLevelId: orgAdminRole._id });
        const studentRole = await RoleLevel.create({ orgId: org._id, name: 'Student', rank: 2, parentRoleLevelId: facultyRole._id });
        const workerRole = await RoleLevel.create({ orgId: org._id, name: 'Worker', rank: 3, parentRoleLevelId: studentRole._id });
        console.log('Seed: Roles created (OrgAdmin, Faculty, Student, Worker)');

        // 4. Users
        const usersData = [
          { name: 'Admin User', email: 'admin@iitmadras.edu', password: 'Admin123!', role: orgAdminRole, status: 'active' },
          { name: 'Dr. Ravi Kumar', email: 'ravi@iitmadras.edu', password: 'Faculty123!', role: facultyRole, status: 'active' },
          { name: 'Priya Sharma', email: 'priya@iitmadras.edu', password: 'Student123!', role: studentRole, status: 'active' },
          { name: 'Suresh Worker', email: 'suresh@iitmadras.edu', password: 'Worker123!', role: workerRole, status: 'active' }
        ];
        for (const u of usersData) {
          const hash = await bcrypt.hash(u.password, 10);
          await User.create({
            name: u.name,
            email: u.email,
            passwordHash: hash,
            orgId: org._id,
            roleLevelId: u.role._id,
            status: u.status
          });
        }
        console.log('Seed: 4 users created (admin, faculty, student, worker)');

        // 5. Resources
        const resourcesData = [
          { 
            name: 'Computer Lab', 
            description: 'High-performance computing lab with 30 workstations', 
            quantity: 5, 
            maxAllowedRank: 2, 
            slotDurationMinutes: 60, 
            operatingHours: { start: '05:00', end: '22:00' },
            createdBy: null
          },
          { 
            name: 'Parking Lot A', 
            description: 'Covered parking for faculty and students', 
            quantity: 10, 
            maxAllowedRank: 3, 
            slotDurationMinutes: 120, 
            operatingHours: { start: '05:00', end: '22:00'},
            createdBy: null
          },
          { 
            name: 'Auditorium', 
            description: 'Main auditorium seating 500 with AV equipment', 
            quantity: 1, 
            maxAllowedRank: 1, 
            slotDurationMinutes: 60, 
            operatingHours: { start: '05:00', end: '22:00'},
            createdBy: null
          }
        ];
        for (const r of resourcesData) {
          await Resource.create({ ...r, orgId: org._id });
        }
        console.log('Seed: 3 resources created (Computer Lab, Parking Lot A, Auditorium)');
        console.log('Seed: Complete.');
        
      } catch (seedErr) {
        // If seeding fails for any reason, log but don't crash the server
        console.error('Seed: Partial or failed seed:', seedErr);
      }
    } else {
      console.log('\nDatabase already has data. Skipping seed.');
    }
  } catch (error) {
    console.error('Seed: Error occurred during seeding:', error);
    // Don't crash the server if seeding fails
  }
};

module.exports = seedData;

// Auto-execute when called directly
if (require.main === module) {
  (async () => {
    await seedData();
    process.exit(0);
  })();
}
