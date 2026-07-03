const WaitingQueue = require('../models/WaitingQueue');
const User = require('../models/User');
const RoleLevel = require('../models/RoleLevel');
const Org = require('../models/Org');

// User joins the waiting queue to join an organization
const joinWaitingQueue = async (req, res) => {
  const { userId } = req.user;
  const { orgId, requestedRoleLevelId } = req.body;

  if (!orgId || !requestedRoleLevelId) {
    return res.status(400).json({ error: 'Organization and requested role are required' });
  }

  try {
    // Check if org exists
    const org = await Org.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if role exists and belongs to this org
    const role = await RoleLevel.findOne({ _id: requestedRoleLevelId, orgId });
    if (!role) {
      return res.status(404).json({ error: 'Role not found in this organization' });
    }

    // Check if user is already in the org
    const existingUser = await User.findById(userId);
    if (existingUser && existingUser.orgId && existingUser.orgId.toString() === orgId.toString()) {
      return res.status(400).json({ error: 'You are already a member of this organization' });
    }

    // Check if already in waiting queue
    const existingQueue = await WaitingQueue.findOne({
      userId,
      orgId,
      status: 'waiting'
    });
    if (existingQueue) {
      return res.status(400).json({ error: 'You are already in the waiting queue for this organization' });
    }

    // Get current position (count of waiting requests)
    const queueCount = await WaitingQueue.countDocuments({
      orgId,
      status: 'waiting'
    });

    // Create waiting queue entry
    const queueEntry = new WaitingQueue({
      userId,
      orgId,
      requestedRoleLevelId,
      status: 'waiting',
      position: queueCount + 1
    });

    await queueEntry.save();

    res.status(201).json({
      message: 'Successfully joined the waiting queue',
      position: queueEntry.position,
      queueId: queueEntry._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to join waiting queue' });
  }
};

// Get pending waiting queue requests for the current user's organization
// Only upper level users can see/approve
const getPendingQueueRequests = async (req, res) => {
  const { userId, orgId, rank } = req.user;

  try {
    // Get all waiting queue entries for this org
    const pendingRequests = await WaitingQueue.find({
      orgId,
      status: 'waiting'
    })
      .populate('userId', 'name email')
      .populate('requestedRoleLevelId', 'name rank')
      .sort({ createdAt: 1 });

    // Filter: only show requests for roles at same or lower level than current user
    const filtered = pendingRequests.filter(req => {
      const requestedRank = req.requestedRoleLevelId?.rank ?? 999;
      // User can approve if: rank 0 (admin) or user's rank is higher (lower number)
      return rank === 0 || (rank !== null && rank < requestedRank);
    });

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending queue requests' });
  }
};

// Approve or reject a waiting queue request
const resolveQueueRequest = async (req, res) => {
  const { queueId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'
  const { userId, rank } = req.user;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  try {
    const queueEntry = await WaitingQueue.findById(queueId)
      .populate('userId')
      .populate('requestedRoleLevelId')
      .populate('orgId');

    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue request not found' });
    }

    if (queueEntry.status !== 'waiting') {
      return res.status(400).json({ error: 'This request has already been resolved' });
    }

    // Auth check: Only rank 0 or higher authority can approve
    const requestedRank = queueEntry.requestedRoleLevelId?.rank ?? 999;
    if (rank !== 0 && (rank === null || rank >= requestedRank)) {
      return res.status(403).json({ error: 'Access denied: You cannot approve requests for this role' });
    }

    if (action === 'approve') {
      // Add user to organization and assign the requested role
      const user = await User.findByIdAndUpdate(
        queueEntry.userId._id,
        {
          orgId: queueEntry.orgId._id,
          roleLevelId: queueEntry.requestedRoleLevelId._id,
          status: 'active'
        },
        { new: true }
      ).populate('roleLevelId');

      // Mark queue entry as approved
      queueEntry.status = 'approved';
      queueEntry.resolvedByUserId = userId;
      await queueEntry.save();

      res.json({
        message: `User ${user.name} has been added to the organization as ${queueEntry.requestedRoleLevelId.name}`,
        user
      });
    } else {
      // Reject
      queueEntry.status = 'rejected';
      queueEntry.resolvedByUserId = userId;
      await queueEntry.save();

      res.json({
        message: 'Request rejected successfully'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to resolve queue request' });
  }
};

module.exports = {
  joinWaitingQueue,
  getPendingQueueRequests,
  resolveQueueRequest
};
