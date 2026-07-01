const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbHandler = require('./dbHandler');
const app = require('../src/app');
const User = require('../src/models/User');
const Org = require('../src/models/Org');
const RoleLevel = require('../src/models/RoleLevel');
const Resource = require('../src/models/Resource');
const Booking = require('../src/models/Booking');

jest.setTimeout(30000);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';

describe('Booking Engine Concurrency - Automated Race Condition Test', () => {
  let token;
  let user;
  let org;
  let role;
  let resource;

  beforeEach(async () => {
    // 1. Create Organization
    org = new Org({
      name: 'Concurrency Test Org',
      type: 'test',
      status: 'active',
      createdBy: new mongoose.Types.ObjectId()
    });
    await org.save();

    // 2. Create RoleLevel
    role = new RoleLevel({
      orgId: org._id,
      name: 'Member',
      rank: 2,
      parentRoleLevelId: null
    });
    await role.save();

    // 3. Create active User
    const passwordHash = await bcrypt.hash('Password123!', 10);
    user = new User({
      name: 'Test Booker',
      email: 'booker@concurrency.com',
      passwordHash,
      orgId: org._id,
      roleLevelId: role._id,
      status: 'active'
    });
    await user.save();

    // 4. Create Resource with maxAllowedRank: 2, operating hours 09:00 to 17:00, duration 60 mins
    resource = new Resource({
      orgId: org._id,
      name: 'Conference Room Alpha',
      maxAllowedRank: 2,
      slotDurationMinutes: 60,
      operatingHours: {
        start: '09:00',
        end: '17:00'
      }
    });
    await resource.save();

    // 5. Generate Access Token
    token = jwt.sign(
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
  });

  it('should successfully book exactly one slot and reject the other with 409 conflict when two requests run concurrently', async () => {
    const slotStart = '2026-07-02T10:00:00.000Z';

    // Send two concurrent booking requests to hold the same slot
    const req1 = request(app)
      .post('/api/bookings/hold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId: resource._id,
        slotStart
      });

    const req2 = request(app)
      .post('/api/bookings/hold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId: resource._id,
        slotStart
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status];
    
    // Assert that one request got 201 Created and the other got 409 Conflict
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // Verify database state: exactly one booking should exist
    const bookings = await Booking.find({
      resourceId: resource._id,
      slotStart: new Date(slotStart)
    });

    expect(bookings.length).toBe(1);
    expect(bookings[0].status).toBe('held');
    expect(bookings[0].userId.toString()).toBe(user._id.toString());

    // Verify the body of the 409 error
    const failedResponse = res1.status === 409 ? res1 : res2;
    expect(failedResponse.body.error).toBe('This slot is already booked or held');
  });
});
