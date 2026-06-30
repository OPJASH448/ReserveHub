const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbHandler = require('./dbHandler');
const app = require('../src/app');
const User = require('../src/models/User');
const Organization = require('../src/models/Organization');
const RoleLevel = require('../src/models/RoleLevel');
const JoinRequest = require('../src/models/JoinRequest');

jest.setTimeout(30000);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_12345';

describe('Strata Day 1 End-to-End API Integration', () => {
  let superAdminToken;
  let superAdminUser;

  beforeEach(async () => {
    // Seed SuperAdmin
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    superAdminUser = new User({
      name: 'SuperAdmin',
      email: 'admin@strata.com',
      passwordHash,
      isSuperAdmin: true,
      status: 'active'
    });
    await superAdminUser.save();

    // Sign SuperAdmin Token
    superAdminToken = jwt.sign(
      { userId: superAdminUser._id, isSuperAdmin: true },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
  });

  it('should go through the full organization lifecycle, role definition, and join request approval flow', async () => {
    // 1. Register an Organization (returns pending status)
    const registerRes = await request(app)
      .post('/api/auth/register-org')
      .send({
        orgName: 'Acme School',
        orgType: 'school',
        userName: 'Alice Admin',
        email: 'alice@acme.edu',
        password: 'AlicePassword123!'
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.orgId).toBeDefined();
    expect(registerRes.body.userId).toBeDefined();

    const orgId = registerRes.body.orgId;
    const aliceId = registerRes.body.userId;

    // 2. Try to login with Alice before SuperAdmin approval (should fail)
    const loginFailRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@acme.edu',
        password: 'AlicePassword123!'
      });

    expect(loginFailRes.status).toBe(403);
    expect(loginFailRes.body.error).toContain('pending approval');

    // 3. SuperAdmin fetches pending organizations
    const pendingOrgsRes = await request(app)
      .get('/api/superadmin/pending-orgs')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(pendingOrgsRes.status).toBe(200);
    expect(pendingOrgsRes.body.length).toBe(1);
    expect(pendingOrgsRes.body[0].name).toBe('Acme School');

    // 4. SuperAdmin approves the Organization
    const approveRes = await request(app)
      .post(`/api/superadmin/approve-org/${orgId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(approveRes.status).toBe(200);

    // Verify Organization is active, and Alice has role "OrgAdmin" at rank 0
    const approvedOrg = await Organization.findById(orgId);
    expect(approvedOrg.status).toBe('active');

    const aliceUser = await User.findById(aliceId).populate('roleLevelId');
    expect(aliceUser.status).toBe('active');
    expect(aliceUser.roleLevelId).toBeDefined();
    expect(aliceUser.roleLevelId.name).toBe('OrgAdmin');
    expect(aliceUser.roleLevelId.rank).toBe(0);

    // 5. Login Alice (should succeed now)
    const loginSuccessRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@acme.edu',
        password: 'AlicePassword123!'
      });

    expect(loginSuccessRes.status).toBe(200);
    expect(loginSuccessRes.body.accessToken).toBeDefined();
    const aliceToken = loginSuccessRes.body.accessToken;

    // 6. Alice creates child RoleLevels (DAG hierarchy: OrgAdmin -> DeptHead -> Teacher)
    const roleOrgAdminId = aliceUser.roleLevelId._id;

    // Create DeptHead (Rank 1)
    const createRole1Res = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'DeptHead',
        parentRoleLevelId: roleOrgAdminId
      });

    expect(createRole1Res.status).toBe(201);
    expect(createRole1Res.body.rank).toBe(1);
    expect(createRole1Res.body.parentRoleLevelId.toString()).toBe(roleOrgAdminId.toString());
    const roleDeptHeadId = createRole1Res.body._id;

    // Create Teacher (Rank 2)
    const createRole2Res = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Teacher',
        parentRoleLevelId: roleDeptHeadId
      });

    expect(createRole2Res.status).toBe(201);
    expect(createRole2Res.body.rank).toBe(2);
    expect(createRole2Res.body.parentRoleLevelId.toString()).toBe(roleDeptHeadId.toString());
    const roleTeacherId = createRole2Res.body._id;

    // 7. A new user (Bob) submits a JoinRequest to join as DeptHead (Rank 1)
    // DeptHead parent is OrgAdmin (Alice, Rank 0). So Alice is the resolver!
    const bobJoinRes = await request(app)
      .post('/api/join-requests')
      .send({
        orgId,
        requestedRoleLevelId: roleDeptHeadId,
        userName: 'Bob DeptHead',
        email: 'bob@acme.edu',
        password: 'BobPassword123!'
      });

    expect(bobJoinRes.status).toBe(201);
    expect(bobJoinRes.body.requestId).toBeDefined();
    const bobRequestId = bobJoinRes.body.requestId;

    // 8. Alice checks pending join requests (Alice should see Bob's request)
    const alicePendingRes = await request(app)
      .get('/api/join-requests/pending')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(alicePendingRes.status).toBe(200);
    expect(alicePendingRes.body.length).toBe(1);
    expect(alicePendingRes.body[0]._id.toString()).toBe(bobRequestId.toString());

    // 9. Alice approves Bob's request
    const aliceResolveRes = await request(app)
      .post(`/api/join-requests/${bobRequestId}/resolve`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ action: 'approve' });

    expect(aliceResolveRes.status).toBe(200);

    // Verify Bob is now active and has DeptHead role
    const bobUser = await User.findOne({ email: 'bob@acme.edu' }).populate('roleLevelId');
    expect(bobUser.status).toBe('active');
    expect(bobUser.roleLevelId._id.toString()).toBe(roleDeptHeadId.toString());

    // 10. Login Bob
    const bobLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bob@acme.edu',
        password: 'BobPassword123!'
      });
    expect(bobLoginRes.status).toBe(200);
    const bobToken = bobLoginRes.body.accessToken;

    // 11. A third user (Charlie) requests to join as Teacher (Rank 2)
    // Teacher parent is DeptHead (Bob, Rank 1). So Bob is the resolver!
    const charlieJoinRes = await request(app)
      .post('/api/join-requests')
      .send({
        orgId,
        requestedRoleLevelId: roleTeacherId,
        userName: 'Charlie Teacher',
        email: 'charlie@acme.edu',
        password: 'CharliePassword123!'
      });
    expect(charlieJoinRes.status).toBe(201);
    const charlieRequestId = charlieJoinRes.body.requestId;

    // Alice checks pending requests. She should NOT see Charlie's request (since she is not the immediate parent)
    const alicePendingRes2 = await request(app)
      .get('/api/join-requests/pending')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(alicePendingRes2.body.length).toBe(0);

    // Bob checks pending requests. He SHOULD see Charlie's request!
    const bobPendingRes = await request(app)
      .get('/api/join-requests/pending')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobPendingRes.body.length).toBe(1);
    expect(bobPendingRes.body[0]._id.toString()).toBe(charlieRequestId.toString());

    // Bob rejects Charlie's request
    const bobResolveRes = await request(app)
      .post(`/api/join-requests/${charlieRequestId}/resolve`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ action: 'reject' });
    expect(bobResolveRes.status).toBe(200);

    // Verify Charlie is rejected
    const charlieUser = await User.findOne({ email: 'charlie@acme.edu' });
    expect(charlieUser.status).toBe('rejected');
  });
});
