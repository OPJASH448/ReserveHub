const RoleLevel = require('../models/RoleLevel');

const createRole = async (req, res) => {
  const { name, parentRoleLevelId } = req.body;
  const orgId = req.user.orgId;

  if (!name || !parentRoleLevelId) {
    return res.status(400).json({ error: 'Name and parentRoleLevelId are required' });
  }

  try {
    // Verify parent role level exists and belongs to the same organization
    const parentRole = await RoleLevel.findOne({ _id: parentRoleLevelId, orgId });
    if (!parentRole) {
      return res.status(400).json({ error: 'Parent role level not found in this organization' });
    }

    // Check if name is already taken in this org
    const existing = await RoleLevel.findOne({ orgId, name });
    if (existing) {
      return res.status(400).json({ error: `Role level name "${name}" already exists in this organization` });
    }

    // Auto-calculate rank
    const rank = parentRole.rank + 1;

    const newRole = new RoleLevel({
      orgId,
      name,
      rank,
      parentRoleLevelId
    });

    await newRole.save();
    res.status(201).json(newRole);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create role level' });
  }
};

const getRoles = async (req, res) => {
  const orgId = req.user.orgId;

  try {
    const roles = await RoleLevel.find({ orgId }).sort({ rank: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch role levels' });
  }
};

module.exports = {
  createRole,
  getRoles
};
