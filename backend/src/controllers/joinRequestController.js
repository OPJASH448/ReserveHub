const bcrypt = require('bcryptjs');
const JoinRequest = require('../models/JoinRequest');
const User = require('../models/User');
const RoleLevel = require('../models/RoleLevel');
const Org = require('../models/Org');
const { runWithTransaction } = require('../utils/transaction');
const { findResolversForJoinRequest } = require('../utils/resolver');

const createJoinRequest = async (req, res) => {
  const { orgId, requestedRoleLevelId, userName, email, password } = req.body;

  if (!orgId || !requestedRoleLevelId || !userName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const org = await Org.findById(orgId);
    if (!org || org.status !== 'active') {
      return res.status(400).json({ error: 'Organization is not active or does not exist' });
    }

    const requestedRole = await RoleLevel.findOne({ _id: requestedRoleLevelId, orgId });
    if (!requestedRole) {
      return res.status(400).json({ error: 'Requested RoleLevel does not exist in this organization' });
    }

    // You cannot request to join as the OrgAdmin (rank 0)
    if (requestedRole.rank === 0) {
      return res.status(400).json({ error: 'Cannot request to join at rank 0 (OrgAdmin)' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await runWithTransaction(async (session) => {
      // Create user as pending with no role assigned yet
      const user = new User({
        name: userName,
        email,
        passwordHash,
        orgId,
        roleLevelId: null,
        status: 'pending'
      });
      await user.save(session ? { session } : {});

      // Create the Join Request
      const joinRequest = new JoinRequest({
        userId: user._id,
        orgId,
        requestedRoleLevelId,
        status: 'pending'
      });
      await joinRequest.save(session ? { session } : {});

      return joinRequest;
    });

    res.status(201).json({
      message: 'Join request submitted successfully. It has been routed to the immediate parent level for approval.',
      requestId: result._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to submit join request' });
  }
};

const getPendingRequestsForResolver = async (req, res) => {
  const { orgId, userId, roleLevelId } = req.user;

  if (!roleLevelId) {
    return res.status(403).json({ error: 'Access denied: User has no assigned role' });
  }

  try {
    // 1. Fetch all pending requests in the organization
    const requests = await JoinRequest.find({
      orgId,
      status: 'pending'
    })
      .populate('userId', 'name email')
      .populate('requestedRoleLevelId', 'name rank parentRoleLevelId');

    // 2. Filter requests where the current user is in the set of eligible resolvers
    const eligibleRequests = [];
    for (const request of requests) {
      const resolvers = await findResolversForJoinRequest(request);
      if (resolvers.some(r => r._id.toString() === userId.toString())) {
        eligibleRequests.push(request);
      }
    }

    res.json(eligibleRequests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending join requests' });
  }
};

const resolveJoinRequest = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'approve' | 'reject'
  const resolverUser = req.user;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
  }

  try {
    const request = await JoinRequest.findById(requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ error: 'Join request not found or already resolved' });
    }

    if (request.orgId.toString() !== resolverUser.orgId.toString()) {
      return res.status(403).json({ error: 'Access denied: Request belongs to another organization' });
    }

    // Verify permission: resolverUser must be one of the active resolvers resolved by the CoR resolver
    const resolvers = await findResolversForJoinRequest(request);
    if (!resolvers.some(r => r._id.toString() === resolverUser.userId.toString())) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to resolve this request' });
    }

    await runWithTransaction(async (session) => {
      request.status = action === 'approve' ? 'approved' : 'rejected';
      request.resolvedByUserId = resolverUser.userId;
      await request.save(session ? { session } : {});

      const updatedStatus = action === 'approve' ? 'active' : 'rejected';
      const updateData = { status: updatedStatus };
      if (action === 'approve') {
        updateData.roleLevelId = request.requestedRoleLevelId;
      }

      await User.findByIdAndUpdate(request.userId, updateData, session ? { session } : {});
    });

    res.json({ message: `Join request successfully ${action}d.` });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to resolve join request' });
  }
};

const submitJoinRequestForUser = async (req, res) => {
  const { orgId, requestedRoleLevelId } = req.body;
  const { userId } = req.user;

  if (!orgId || !requestedRoleLevelId) {
    return res.status(400).json({ error: 'Organization and Desired Role are required' });
  }

  try {
    const org = await Org.findById(orgId);
    if (!org || org.status !== 'active') {
      return res.status(400).json({ error: 'Organization is not active or does not exist' });
    }

    const requestedRole = await RoleLevel.findOne({ _id: requestedRoleLevelId, orgId });
    if (!requestedRole) {
      return res.status(400).json({ error: 'Requested RoleLevel does not exist in this organization' });
    }

    if (requestedRole.rank === 0) {
      return res.status(400).json({ error: 'Cannot request to join at rank 0 (OrgAdmin)' });
    }

    // Create the Join Request
    const joinRequest = new JoinRequest({
      userId: userId,
      orgId,
      requestedRoleLevelId,
      status: 'pending'
    });
    await joinRequest.save();

    // Link user to org but keep status active so they can remain logged in and see requests
    await User.findByIdAndUpdate(userId, { orgId });

    res.status(201).json({
      message: 'Join request submitted successfully! Your account remains active so you can track approval progress below.',
      requestId: joinRequest._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to submit join request' });
  }
};

const getMyJoinRequests = async (req, res) => {
  try {
    const requests = await JoinRequest.find({ userId: req.user.userId })
      .populate('orgId', 'name type')
      .populate('requestedRoleLevelId', 'name rank');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your join requests' });
  }
};

module.exports = {
  createJoinRequest,
  getPendingRequestsForResolver,
  resolveJoinRequest,
  submitJoinRequestForUser,
  getMyJoinRequests
};
