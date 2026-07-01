const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const dbHandler = require('../tests/dbHandler');
const app = require('../src/app');
const Org = require('../src/models/Org');
const User = require('../src/models/User');
const RoleLevel = require('../src/models/RoleLevel');
const Resource = require('../src/models/Resource');
const Booking = require('../src/models/Booking');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';

const runRaceTest = async () => {
  console.log('Starting self-contained concurrency race-test server...');
  await dbHandler.connect();

  // Seed data
  const org = new Org({
    name: 'Race Org',
    type: 'test',
    status: 'active',
    createdBy: new mongoose.Types.ObjectId()
  });
  await org.save();

  const role = new RoleLevel({
    orgId: org._id,
    name: 'Member',
    rank: 2,
    parentRoleLevelId: null
  });
  await role.save();

  const passwordHash = await bcrypt.hash('password123', 10);
  const user = new User({
    name: 'Booker',
    email: 'booker@race.com',
    passwordHash,
    orgId: org._id,
    roleLevelId: role._id,
    status: 'active'
  });
  await user.save();

  const resource = new Resource({
    orgId: org._id,
    name: 'Meeting Room',
    maxAllowedRank: 2,
    slotDurationMinutes: 60,
    operatingHours: {
      start: '09:00',
      end: '17:00'
    }
  });
  await resource.save();

  // Start Express server
  const port = 10001;
  const server = app.listen(port, () => {
    console.log(`Race server running on http://localhost:${port}`);
  });

  // Sign access token
  const token = jwt.sign(
    {
      userId: user._id,
      orgId: org._id,
      roleLevelId: role._id,
      rank: 2,
      isSuperAdmin: false
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );

  const slotStart = '2026-07-02T09:00:00.000Z';
  const holdUrl = `http://localhost:${port}/api/bookings/hold`;

  console.log(`Sending two concurrent POST requests to hold slot ${slotStart}...`);
  const logs = [];
  logs.push(`=== Concurrency Race Test Execution Log ===`);
  logs.push(`Timestamp: ${new Date().toISOString()}`);
  logs.push(`Target URL: ${holdUrl}`);
  logs.push(`Resource: ${resource.name} (${resource._id})`);
  logs.push(`Slot Start: ${slotStart}\n`);

  const reqConfig = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const payload = {
    resourceId: resource._id,
    slotStart
  };

  const startTime = Date.now();

  // Send requests concurrently
  const [res1, res2] = await Promise.allSettled([
    axios.post(holdUrl, payload, reqConfig),
    axios.post(holdUrl, payload, reqConfig)
  ]);

  const duration = Date.now() - startTime;
  logs.push(`Requests completed in ${duration}ms.\n`);

  const processResponse = (resIndex, result) => {
    logs.push(`--- Request ${resIndex} Result ---`);
    if (result.status === 'fulfilled') {
      const response = result.value;
      logs.push(`Status: ${response.status} ${response.statusText}`);
      logs.push(`Response Body: ${JSON.stringify(response.data, null, 2)}`);
    } else {
      const error = result.reason;
      if (error.response) {
        logs.push(`Status: ${error.response.status} ${error.response.statusText}`);
        logs.push(`Response Body: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        logs.push(`Error: ${error.message}`);
      }
    }
    logs.push('');
  };

  processResponse(1, res1);
  processResponse(2, res2);

  // Validate state in database
  const activeBookingsCount = await Booking.countDocuments({
    resourceId: resource._id,
    slotStart: new Date(slotStart),
    status: { $in: ['held', 'confirmed'] }
  });
  logs.push(`--- Database Integrity Check ---`);
  logs.push(`Active bookings in database for slot: ${activeBookingsCount}`);
  logs.push(activeBookingsCount === 1 ? 'PASS: Concurrency handled correctly (Exactly one booking created)' : 'FAIL: Concurrency failure');

  const logText = logs.join('\n');
  console.log(logText);

  // Write log to root docs directory & backend/docs
  const rootDocsDir = path.join(__dirname, '..', '..', 'docs');
  const backendDocsDir = path.join(__dirname, '..', 'docs');

  if (!fs.existsSync(rootDocsDir)) {
    fs.mkdirSync(rootDocsDir, { recursive: true });
  }
  if (!fs.existsSync(backendDocsDir)) {
    fs.mkdirSync(backendDocsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(rootDocsDir, 'race_log.txt'), logText);
  fs.writeFileSync(path.join(backendDocsDir, 'race_log.txt'), logText);
  console.log(`Log successfully written to:`);
  console.log(`- ${path.join(rootDocsDir, 'race_log.txt')}`);
  console.log(`- ${path.join(backendDocsDir, 'race_log.txt')}`);

  // Shutdown server and db
  server.close(async () => {
    await dbHandler.closeDatabase();
    console.log('Concluded race-test server and DB connections.');
    process.exit(0);
  });
};

runRaceTest().catch(err => {
  console.error('Unhandled error in race test:', err);
  process.exit(1);
});
