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

    const alreadySeeded = orgCount > 0 && userCount >= 4 && resourceCount > 0;

    if (alreadySeeded) {
      console.log('\nDatabase has data. Running upsert seed to add departments to existing records...');
    } else {
      console.log('\nDatabase is empty or incomplete. Running full seed...');
    }

    try {
      // 1. SuperAdmin (upsert by email)
      const saHash = await bcrypt.hash('SuperSecretAdmin123!', 10);
      await SuperAdmin.findOneAndUpdate(
        { email: 'admin@strata.com' },
        { name: 'Super Admin', email: 'admin@strata.com', passwordHash: saHash },
        { upsert: true, new: true }
      );

      // 2. IIT Madras org (upsert by name)
      const org = await Org.findOneAndUpdate(
        { name: 'IIT Madras' },
        { type: 'Educational Institute', status: 'active' },
        { upsert: true, new: true }
      );

      // 3. Role levels (upsert by orgId + name)
      const roleNames = ['OrgAdmin', 'CSE Faculty', 'ECE Faculty', 'CSE Student', 'ECE Student', 'Worker'];
      const roleMap = {};
      for (let i = 0; i < roleNames.length; i++) {
        const role = await RoleLevel.findOneAndUpdate(
          { orgId: org._id, name: roleNames[i] },
          { rank: [0, 1, 1, 2, 2, 3][i] },
          { upsert: true, new: true }
        );
        roleMap[roleNames[i]] = role;
      }
      // Link parent roles
      await RoleLevel.findOneAndUpdate({ orgId: org._id, name: 'CSE Faculty' }, { parentRoleLevelId: roleMap.OrgAdmin._id });
      await RoleLevel.findOneAndUpdate({ orgId: org._id, name: 'ECE Faculty' }, { parentRoleLevelId: roleMap.OrgAdmin._id });
      await RoleLevel.findOneAndUpdate({ orgId: org._id, name: 'CSE Student' }, { parentRoleLevelId: roleMap['CSE Faculty']._id });
      await RoleLevel.findOneAndUpdate({ orgId: org._id, name: 'ECE Student' }, { parentRoleLevelId: roleMap['ECE Faculty']._id });
      await RoleLevel.findOneAndUpdate({ orgId: org._id, name: 'Worker' }, { parentRoleLevelId: roleMap.OrgAdmin._id });

      // 4. Users (upsert by email)
      const usersData = [
        { name: 'Admin User', email: 'admin@iitmadras.edu', password: 'Admin123!', role: roleMap.OrgAdmin, status: 'active', department: 'Administration' },
        { name: 'Dr. Ravi Kumar', email: 'ravi@iitmadras.edu', password: 'Faculty123!', role: roleMap['CSE Faculty'], status: 'active', department: 'Computer Science' },
        { name: 'Dr. Meena Patel', email: 'meena@iitmadras.edu', password: 'Faculty123!', role: roleMap['ECE Faculty'], status: 'active', department: 'Electronics' },
        { name: 'Priya Sharma', email: 'priya@iitmadras.edu', password: 'Student123!', role: roleMap['CSE Student'], status: 'active', department: 'Computer Science' },
        { name: 'Arun Kumar', email: 'arun@iitmadras.edu', password: 'Student123!', role: roleMap['ECE Student'], status: 'active', department: 'Electronics' },
        { name: 'Suresh Worker', email: 'suresh@iitmadras.edu', password: 'Worker123!', role: roleMap.Worker, status: 'active', department: 'Maintenance' }
      ];
      for (const u of usersData) {
        const hash = await bcrypt.hash(u.password, 10);
        await User.findOneAndUpdate(
          { email: u.email },
          {
            name: u.name,
            passwordHash: hash,
            orgId: org._id,
            roleLevelId: u.role._id,
            department: u.department,
            status: u.status
          },
          { upsert: true, new: true }
        );
      }

      // Update existing users that are NOT in our seed list: set department to empty
      const seededEmails = usersData.map(u => u.email);
      await User.updateMany(
        { email: { $nin: seededEmails } },
        { $set: { department: '' } }
      );

      // 5. Resources (upsert by orgId + name)
      const resourcesData = [
        {
          name: 'CSE Computer Lab',
          description: 'High-performance computing lab for CSE department with 30 workstations',
          quantity: 5, maxAllowedRank: 2, department: 'Computer Science',
          slotDurationMinutes: 60, operatingHours: { start: '05:00', end: '22:00' }, createdBy: null
        },
        {
          name: 'ECE Electronics Lab',
          description: 'Electronics lab with oscilloscopes and FPGA boards for ECE department',
          quantity: 3, maxAllowedRank: 2, department: 'Electronics',
          slotDurationMinutes: 90, operatingHours: { start: '05:00', end: '22:00' }, createdBy: null
        },
        {
          name: 'Parking Lot A',
          description: 'Covered parking for all staff and students',
          quantity: 10, maxAllowedRank: 3, department: 'Administration',
          slotDurationMinutes: 120, operatingHours: { start: '05:00', end: '22:00' }, createdBy: null
        },
        {
          name: 'Main Auditorium',
          description: 'Main auditorium seating 500 with AV equipment',
          quantity: 1, maxAllowedRank: 1, department: 'Administration',
          slotDurationMinutes: 60, operatingHours: { start: '05:00', end: '22:00' }, createdBy: null
        }
      ];
      for (const r of resourcesData) {
        await Resource.findOneAndUpdate(
          { orgId: org._id, name: r.name },
          { ...r, orgId: org._id },
          { upsert: true, new: true }
        );
      }

      // Update existing resources not in seed list: set department to empty (visible to all)
      const seededResNames = resourcesData.map(r => r.name);
      await Resource.updateMany(
        { orgId: org._id, name: { $nin: seededResNames } },
        { $set: { department: '' } }
      );

      console.log('Seed: Upsert complete.');
    } catch (seedErr) {
      console.error('Seed: Error:', seedErr);
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
