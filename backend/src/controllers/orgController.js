const Org = require('../models/Org');
const User = require('../models/User');
const RoleLevel = require('../models/RoleLevel');
const { runWithTransaction } = require('../utils/transaction');

const getPendingOrgs = async (req, res) => {
  try {
    const orgs = await Org.find({ status: 'pending' }).populate('createdBy', 'name email');
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending organizations' });
  }
};

const getAllOrgs = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};
    const orgs = await Org.find(filter).populate('createdBy', 'name email').sort({ createdAt: -1 });
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

const approveOrg = async (req, res) => {
  const { orgId } = req.params;

  try {
    const org = await Org.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    if (org.status !== 'pending') {
      return res.status(400).json({ error: `Organization is already ${org.status}` });
    }

    const creator = await User.findById(org.createdBy);
    if (!creator) {
      return res.status(404).json({ error: 'Organization creator not found' });
    }

    await runWithTransaction(async (session) => {
      // 1. Set organization status to active
      org.status = 'active';
      await org.save(session ? { session } : {});

      // 2. Create the Rank 0 RoleLevel (OrgAdmin)
      const orgAdminRole = new RoleLevel({
        orgId: org._id,
        name: 'OrgAdmin',
        rank: 0,
        parentRoleLevelId: null
      });
      await orgAdminRole.save(session ? { session } : {});

      // 3. Assign OrgAdmin role and activate the creator user
      creator.roleLevelId = orgAdminRole._id;
      creator.status = 'active';
      await creator.save(session ? { session } : {});
    });

    res.json({ message: 'Organization approved successfully. Admin role created and creator activated.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to approve organization' });
  }
};

const rejectOrg = async (req, res) => {
  const { orgId } = req.params;

  try {
    const org = await Org.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    if (org.status !== 'pending') {
      return res.status(400).json({ error: `Organization is already ${org.status}` });
    }

    await runWithTransaction(async (session) => {
      org.status = 'rejected';
      await org.save(session ? { session } : {});

      // Set creator status to rejected
      await User.findByIdAndUpdate(org.createdBy, { status: 'rejected' }, session ? { session } : {});
    });

    res.json({ message: 'Organization registration rejected.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to reject organization' });
  }
};

module.exports = {
  getPendingOrgs,
  getAllOrgs,
  approveOrg,
  rejectOrg
};
