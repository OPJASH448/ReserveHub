const mongoose = require('mongoose');
const dbHandler = require('./dbHandler');
const User = require('../src/models/User');
const RoleLevel = require('../src/models/RoleLevel');
const Organization = require('../src/models/Organization');
const JoinRequest = require('../src/models/JoinRequest');
const { findResolversForJoinRequest } = require('../src/utils/resolver');

jest.setTimeout(30000);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

describe('Generic JoinRequest Resolver Engine', () => {
  it('should resolve join requests correctly using the parentRoleLevelId DAG pointers on a 5-level hierarchy', async () => {
    // 1. Create Organization
    const org = new Organization({
      name: 'Test Org',
      type: 'generic',
      status: 'active',
      createdBy: new mongoose.Types.ObjectId()
    });
    await org.save();

    // 2. Fabricate 5-level RoleLevel DAG chain
    // Rank 0 (Top) -> Rank 1 -> Rank 2 -> Rank 3 -> Rank 4 (Bottom)
    const roleRank0 = new RoleLevel({ orgId: org._id, name: 'LevelZero', rank: 0, parentRoleLevelId: null });
    await roleRank0.save();

    const roleRank1 = new RoleLevel({ orgId: org._id, name: 'LevelOne', rank: 1, parentRoleLevelId: roleRank0._id });
    await roleRank1.save();

    const roleRank2 = new RoleLevel({ orgId: org._id, name: 'LevelTwo', rank: 2, parentRoleLevelId: roleRank1._id });
    await roleRank2.save();

    const roleRank3 = new RoleLevel({ orgId: org._id, name: 'LevelThree', rank: 3, parentRoleLevelId: roleRank2._id });
    await roleRank3.save();

    const roleRank4 = new RoleLevel({ orgId: org._id, name: 'LevelFour', rank: 4, parentRoleLevelId: roleRank3._id });
    await roleRank4.save();

    // 3. Populate Users at each level
    // Active Users (should be resolvers)
    const userRank0 = await User.create({ name: 'Admin User', email: 'r0@test.com', passwordHash: 'hash', orgId: org._id, roleLevelId: roleRank0._id, status: 'active' });
    const userRank1 = await User.create({ name: 'Manager User', email: 'r1@test.com', passwordHash: 'hash', orgId: org._id, roleLevelId: roleRank1._id, status: 'active' });
    const userRank2 = await User.create({ name: 'Supervisor User', email: 'r2@test.com', passwordHash: 'hash', orgId: org._id, roleLevelId: roleRank2._id, status: 'active' });
    const userRank3 = await User.create({ name: 'Staff User', email: 'r3@test.com', passwordHash: 'hash', orgId: org._id, roleLevelId: roleRank3._id, status: 'active' });
    // Note: We don't need active users at rank 4 because nobody has a rank 5 to route to them.

    // Inactive/Pending Users (should NOT be resolvers)
    const pendingUserRank1 = await User.create({ name: 'Pending Manager', email: 'pending_r1@test.com', passwordHash: 'hash', orgId: org._id, roleLevelId: roleRank1._id, status: 'pending' });
    const inactiveUserRank2 = await User.create({ name: 'Rejected Supervisor', email: 'inactive_r2@test.com', passwordHash: 'hash', orgId: org._id, roleLevelId: roleRank2._id, status: 'rejected' });

    // 4. Test Case A: Join Request for Rank 3 (LevelThree)
    // The immediate parent is Rank 2 (LevelTwo). Active resolver should be userRank2.
    const requestRank3 = new JoinRequest({
      userId: new mongoose.Types.ObjectId(),
      orgId: org._id,
      requestedRoleLevelId: roleRank3._id,
      status: 'pending'
    });
    await requestRank3.save();

    const resolversRank3 = await findResolversForJoinRequest(requestRank3);
    
    // Assertions
    expect(resolversRank3.length).toBe(1);
    expect(resolversRank3[0]._id.toString()).toBe(userRank2._id.toString());
    // Ensure inactive or pending users at the parent level are ignored
    expect(resolversRank3.some(u => u._id.toString() === inactiveUserRank2._id.toString())).toBe(false);

    // 5. Test Case B: Join Request for Rank 1 (LevelOne)
    // The immediate parent is Rank 0 (LevelZero). Active resolver should be userRank0.
    const requestRank1 = new JoinRequest({
      userId: new mongoose.Types.ObjectId(),
      orgId: org._id,
      requestedRoleLevelId: roleRank1._id,
      status: 'pending'
    });
    await requestRank1.save();

    const resolversRank1 = await findResolversForJoinRequest(requestRank1);
    expect(resolversRank1.length).toBe(1);
    expect(resolversRank1[0]._id.toString()).toBe(userRank0._id.toString());

    // 6. Test Case C: Join Request for Rank 0 (LevelZero)
    // LevelZero has no parent. Resolver list should be empty.
    const requestRank0 = new JoinRequest({
      userId: new mongoose.Types.ObjectId(),
      orgId: org._id,
      requestedRoleLevelId: roleRank0._id,
      status: 'pending'
    });
    await requestRank0.save();

    const resolversRank0 = await findResolversForJoinRequest(requestRank0);
    expect(resolversRank0.length).toBe(0);
  });
});
