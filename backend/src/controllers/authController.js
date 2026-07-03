const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Org = require('../models/Org');
const RoleLevel = require('../models/RoleLevel');
const SuperAdmin = require('../models/SuperAdmin');
const { runWithTransaction } = require('../utils/transaction');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';

const generateToken = (user) => {
  const payload = {
    userId: user._id,
    orgId: user.orgId || null,
    roleLevelId: user.roleLevelId ? (user.roleLevelId._id || user.roleLevelId) : null,
    rank: user.roleLevelId ? (user.roleLevelId.rank !== undefined ? user.roleLevelId.rank : null) : null,
    isSuperAdmin: !!user.isSuperAdmin
  };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '8h' });
};

// Public: list all active orgs (for sign-up form)
const listActiveOrgs = async (req, res) => {
  try {
    const orgs = await Org.find({ status: 'active' }).select('_id name type');
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
};

// Public: list roles for a specific active org (for sign-up form)
const listOrgRoles = async (req, res) => {
  const { orgId } = req.params;
  try {
    const org = await Org.findOne({ _id: orgId, status: 'active' });
    if (!org) return res.status(404).json({ error: 'Organization not found or not active' });

    // Exclude rank 0 (OrgAdmin) — users can't request to join as admin
    const roles = await RoleLevel.find({ orgId, rank: { $gt: 0 } }).sort({ rank: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

// Register a new organization + its founding admin (active immediately, no SuperAdmin)
const registerOrg = async (req, res) => {
  const { orgName, orgType, userName, email, password } = req.body;

  if (!orgName || !orgType || !userName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existingOrg = await Org.findOne({ name: orgName });
    if (existingOrg) {
      return res.status(400).json({ error: 'Organization name already exists' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let org;
    let user;
    let orgAdminRole;
    const generatedUserId = new mongoose.Types.ObjectId();

    await runWithTransaction(async (session) => {
      // 1. Create org as active
      org = new Org({
        name: orgName,
        type: orgType,
        status: 'active',
        createdBy: generatedUserId
      });
      await org.save(session ? { session } : {});

      // 2. Create the OrgAdmin role level (rank 0)
      orgAdminRole = new RoleLevel({
        orgId: org._id,
        name: 'OrgAdmin',
        rank: 0,
        parentRoleLevelId: null
      });
      await orgAdminRole.save(session ? { session } : {});

      // 3. Create active user with the RoleLevel and generated ID
      user = new User({
        _id: generatedUserId,
        name: userName,
        email: normalizedEmail,
        passwordHash,
        orgId: org._id,
        roleLevelId: orgAdminRole._id,
        status: 'active'
      });
      await user.save(session ? { session } : {});
    });

    res.status(201).json({
      message: 'Organization and Admin user registered successfully! You can sign in now.',
      orgId: org._id,
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to register organization' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Regular user
    const user = await User.findOne({ email: normalizedEmail }).populate('roleLevelId');
    if (!user) return res.status(401).json({ error: 'Email not found' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval. Please wait.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: `Your account has been ${user.status}.` });
    }

    const accessToken = generateToken(user);

    return res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        orgId: user.orgId,
        roleLevelId: user.roleLevelId ? user.roleLevelId._id : null,
        roleName: user.roleLevelId ? user.roleLevelId.name : null,
        rank: user.roleLevelId ? user.roleLevelId.rank : null,
        isSuperAdmin: false
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

// Generic User Sign Up (only name, email, password, confirm password done in frontend)
const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email: normalizedEmail,
      passwordHash,
      status: 'active', // active so they can log in and then create/join an org
      orgId: null,
      roleLevelId: null
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully! Please sign in.' });
  } catch (error) {
    res.status(500).json({ error: 'User registration failed' });
  }
};

// Registered user creates an organization (approved immediately, user becomes OrgAdmin)
const createOrgForUser = async (req, res) => {
  const { orgName, orgType } = req.body;
  const { userId } = req.user;

  if (!orgName || !orgType) {
    return res.status(400).json({ error: 'Organization name and type are required' });
  }

  try {
    const existingOrg = await Org.findOne({ name: orgName });
    if (existingOrg) {
      return res.status(400).json({ error: 'Organization name already exists' });
    }

    let org;
    let orgAdminRole;

    await runWithTransaction(async (session) => {
      // 1. Create active organization
      org = new Org({
        name: orgName,
        type: orgType,
        status: 'active',
        createdBy: userId
      });
      await org.save(session ? { session } : {});

      // 2. Create the Rank 0 RoleLevel (OrgAdmin)
      orgAdminRole = new RoleLevel({
        orgId: org._id,
        name: 'OrgAdmin',
        rank: 0,
        parentRoleLevelId: null
      });
      await orgAdminRole.save(session ? { session } : {});

      // 3. Update the creator user
      await User.findByIdAndUpdate(userId, {
        orgId: org._id,
        roleLevelId: orgAdminRole._id,
        status: 'active'
      }, session ? { session } : {});
    });

    // Populate user and generate new token so frontend can hot-reload their new credentials/role level
    const updatedUser = await User.findById(userId).populate('roleLevelId');
    const accessToken = generateToken(updatedUser);

    res.status(201).json({
      message: 'Organization created successfully! You are now the OrgAdmin.',
      orgId: org._id,
      accessToken,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        orgId: updatedUser.orgId,
        roleLevelId: updatedUser.roleLevelId ? updatedUser.roleLevelId._id : null,
        roleName: updatedUser.roleLevelId ? updatedUser.roleLevelId.name : null,
        rank: updatedUser.roleLevelId ? updatedUser.roleLevelId.rank : null,
        isSuperAdmin: false
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create organization' });
  }
};

// Switch active organization (user becomes OrgAdmin of another org they created)
const switchOrg = async (req, res) => {
  const { orgId } = req.params;
  const { userId } = req.user;

  try {
    const org = await Org.findOne({ _id: orgId, createdBy: userId });
    if (!org) {
      return res.status(403).json({ error: 'Access denied: You do not own this organization' });
    }

    const orgAdminRole = await RoleLevel.findOne({ orgId: org._id, rank: 0 });
    if (!orgAdminRole) {
      return res.status(500).json({ error: 'OrgAdmin role not found for this organization' });
    }

    const user = await User.findByIdAndUpdate(userId, {
      orgId: org._id,
      roleLevelId: orgAdminRole._id
    }, { new: true }).populate('roleLevelId');

    const accessToken = generateToken(user);

    res.json({
      message: `Switched active organization to ${org.name}`,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        orgId: user.orgId,
        roleLevelId: user.roleLevelId ? user.roleLevelId._id : null,
        roleName: user.roleLevelId ? user.roleLevelId.name : null,
        rank: user.roleLevelId ? user.roleLevelId.rank : null,
        isSuperAdmin: false
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to switch organization' });
  }
};

const getMyOrgs = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('roleLevelId', 'name rank');
    const currentOrgId = user?.orgId;

    const orgIds = new Set();
    if (currentOrgId) orgIds.add(currentOrgId.toString());

    const createdOrgs = await Org.find({ createdBy: req.user.userId }).select('_id');
    createdOrgs.forEach(o => orgIds.add(o._id.toString()));

    const allOrgs = await Org.find({ _id: { $in: Array.from(orgIds) } }).populate('createdBy', 'name email');

    const result = allOrgs.map(org => {
      const isMember = currentOrgId && org._id.toString() === currentOrgId.toString();
      return {
        ...org.toObject(),
        isMember,
        memberRole: isMember && user.roleLevelId ? {
          name: user.roleLevelId.name,
          rank: user.roleLevelId.rank
        } : null
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your organizations' });
  }
};

module.exports = {
  registerOrg,
  login,
  logout,
  listActiveOrgs,
  listOrgRoles,
  register,
  createOrgForUser,
  getMyOrgs,
  switchOrg
};
