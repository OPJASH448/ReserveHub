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
const Waitlist = require('../src/models/Waitlist');

jest.setTimeout(30000);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';

describe('Waitlist Observer Integration', () => {
  let tokenA, tokenB;
  let userA, userB;
  let org;
  let role;
  let resource;

  beforeEach(async () => {
    org = new Org({
      name: 'Waitlist Test Org',
      type: 'test',
      status: 'active',
      createdBy: new mongoose.Types.ObjectId()
    });
    await org.save();

    role = new RoleLevel({
      orgId: org._id,
      name: 'Member',
      rank: 2,
      parentRoleLevelId: null
    });
    await role.save();

    const passwordHash = await bcrypt.hash('Password123!', 10);
    userA = new User({
      name: 'User A',
      email: 'a@test.com',
      passwordHash,
      orgId: org._id,
      roleLevelId: role._id,
      status: 'active'
    });
    await userA.save();

    userB = new User({
      name: 'User B',
      email: 'b@test.com',
      passwordHash,
      orgId: org._id,
      roleLevelId: role._id,
      status: 'active'
    });
    await userB.save();

    resource = new Resource({
      orgId: org._id,
      name: 'Studio Space',
      maxAllowedRank: 2,
      slotDurationMinutes: 60,
      operatingHours: {
        start: '09:00',
        end: '17:00'
      }
    });
    await resource.save();

    tokenA = jwt.sign({ userId: userA._id, orgId: org._id, roleLevelId: role._id, rank: 2, isSuperAdmin: false }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    tokenB = jwt.sign({ userId: userB._id, orgId: org._id, roleLevelId: role._id, rank: 2, isSuperAdmin: false }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
  });

  it('should promote the next waitlisted user when a booking is cancelled', async () => {
    const slotStart = '2026-07-02T09:00:00.000Z';

    // 1. User A holds the slot
    const holdRes = await request(app)
      .post('/api/bookings/hold')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ resourceId: resource._id, slotStart });
    expect(holdRes.status).toBe(201);
    const bookingIdA = holdRes.body._id;

    // 2. User B joins the waitlist
    const waitlistRes = await request(app)
      .post('/api/waitlists/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ resourceId: resource._id, slotStart });
    expect(waitlistRes.status).toBe(201);
    expect(waitlistRes.body.position).toBe(1);

    // 3. User A cancels their booking
    const cancelRes = await request(app)
      .post(`/api/bookings/${bookingIdA}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(cancelRes.status).toBe(200);

    // Give observer event processing a short moment
    await new Promise(resolve => setTimeout(resolve, 200));

    // 4. Assert User B has been promoted to a held booking
    const bookingB = await Booking.findOne({
      resourceId: resource._id,
      userId: userB._id,
      slotStart: new Date(slotStart)
    });
    expect(bookingB).toBeDefined();
    expect(bookingB.status).toBe('held');

    // 5. Assert User B waitlist entry is deleted
    const waitlistEntry = await Waitlist.findOne({
      resourceId: resource._id,
      userId: userB._id,
      slotStart: new Date(slotStart)
    });
    expect(waitlistEntry).toBeNull();
  });
});
