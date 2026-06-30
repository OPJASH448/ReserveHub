const mongoose = require('mongoose');
const dbHandler = require('./dbHandler');
const User = require('../src/models/User');
const RoleLevel = require('../src/models/RoleLevel');
const Organization = require('../src/models/Organization');
const JoinRequest = require('../src/models/JoinRequest');
const { findResolversForJoinRequest, resolveRoleLevel } = require('../src/utils/resolver');

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

  describe('resolveRoleLevel - Chain of Responsibility Upward Walking', () => {
    let org;
    let roleL0, roleL1, roleL2, roleL3;

    beforeEach(async () => {
      org = new Organization({
        name: 'CoR Test Org',
        type: 'testing',
        status: 'active',
        createdBy: new mongoose.Types.ObjectId()
      });
      await org.save();

      // Chain: L0 (Rank 0) -> L1 (Rank 1) -> L2 (Rank 2) -> L3 (Rank 3)
      roleL0 = await RoleLevel.create({ orgId: org._id, name: 'L0', rank: 0, parentRoleLevelId: null });
      roleL1 = await RoleLevel.create({ orgId: org._id, name: 'L1', rank: 1, parentRoleLevelId: roleL0._id });
      roleL2 = await RoleLevel.create({ orgId: org._id, name: 'L2', rank: 2, parentRoleLevelId: roleL1._id });
      roleL3 = await RoleLevel.create({ orgId: org._id, name: 'L3', rank: 3, parentRoleLevelId: roleL2._id });
    });

    it('should resolve to parent in a simple 2-level chain (L1 requested, L0 has active user)', async () => {
      const activeAdmin = await User.create({
        name: 'Admin', email: 'admin@cor.com', passwordHash: 'hash',
        orgId: org._id, roleLevelId: roleL0._id, status: 'active'
      });

      const resolvers = await resolveRoleLevel(org._id, roleL1._id);
      expect(resolvers.length).toBe(1);
      expect(resolvers[0]._id.toString()).toBe(activeAdmin._id.toString());
    });

    it('should walk up multiple ranks when intermediate parents have no active users (4-level chain)', async () => {
      // Scenario: Request L3 (rank 3). Parent is L2 (rank 2).
      // If L2 and L1 have no active users, resolution should walk up to L0 and find the active user there.
      const activeL0 = await User.create({
        name: 'L0 User', email: 'l0@cor.com', passwordHash: 'hash',
        orgId: org._id, roleLevelId: roleL0._id, status: 'active'
      });

      // No active users at L2 or L1! Let's resolve for L3
      const resolvers = await resolveRoleLevel(org._id, roleL3._id);
      expect(resolvers.length).toBe(1);
      expect(resolvers[0]._id.toString()).toBe(activeL0._id.toString());
    });

    it('should walk up to first available active level (e.g., L1 active, L2 inactive)', async () => {
      const activeL1 = await User.create({
        name: 'L1 User', email: 'l1@cor.com', passwordHash: 'hash',
        orgId: org._id, roleLevelId: roleL1._id, status: 'active'
      });
      // Admin is also active, but L1 is closer to L3 (L3 -> L2 -> L1), so it should stop at L1
      await User.create({
        name: 'Admin', email: 'admin@cor.com', passwordHash: 'hash',
        orgId: org._id, roleLevelId: roleL0._id, status: 'active'
      });

      const resolvers = await resolveRoleLevel(org._id, roleL3._id);
      expect(resolvers.length).toBe(1);
      expect(resolvers[0]._id.toString()).toBe(activeL1._id.toString());
    });

    it('should return empty if requested role is rank 0 itself', async () => {
      await User.create({
        name: 'Admin', email: 'admin@cor.com', passwordHash: 'hash',
        orgId: org._id, roleLevelId: roleL0._id, status: 'active'
      });

      const resolvers = await resolveRoleLevel(org._id, roleL0._id);
      expect(resolvers.length).toBe(0);
    });
  });
});
