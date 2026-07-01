const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Org = require('../models/Org');
const SuperAdmin = require('../models/SuperAdmin');
const { runWithTransaction } = require('../utils/transaction');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';

const generateToken = (user) => {
  const payload = {
    userId: user._id,
    orgId: user.orgId || null,
    roleLevelId: user.roleLevelId ? user.roleLevelId._id : null,
    rank: user.roleLevelId ? user.roleLevelId.rank : null,
    isSuperAdmin: !!user.isSuperAdmin
  };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};

const registerOrg = async (req, res) => {
  const { orgName, orgType, userName, email, password } = req.body;

  if (!orgName || !orgType || !userName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingOrg = await Org.findOne({ name: orgName });
    if (existingOrg) {
      return res.status(400).json({ error: 'Organization name already exists' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await runWithTransaction(async (session) => {
      const user = new User({
        name: userName,
        email,
        passwordHash,
        status: 'pending'
      });
      await user.save(session ? { session } : {});

      const org = new Org({
        name: orgName,
        type: orgType,
        status: 'pending',
        createdBy: user._id
      });
      await org.save(session ? { session } : {});

      user.orgId = org._id;
      await user.save(session ? { session } : {});

      return { org, user };
    });

    res.status(201).json({
      message: 'Organization and administrator registered successfully and are pending approval',
      orgId: result.org._id,
      userId: result.user._id
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

  try {
    let user = await SuperAdmin.findOne({ email });
    let isSuper = false;

    if (user) {
      isSuper = true;
    } else {
      user = await User.findOne({ email }).populate('roleLevelId');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!isSuper && user.status !== 'active') {
      if (user.status === 'pending') {
        return res.status(403).json({ error: 'Your account or organization is pending approval' });
      }
      return res.status(403).json({ error: `Your account is ${user.status}` });
    }

    if (isSuper) {
      user = user.toObject();
      user.isSuperAdmin = true;
    }

    const accessToken = generateToken(user);

    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        orgId: user.orgId || null,
        roleLevelId: user.roleLevelId ? user.roleLevelId._id : null,
        roleName: user.roleLevelId ? user.roleLevelId.name : null,
        rank: user.roleLevelId ? user.roleLevelId.rank : null,
        isSuperAdmin: !!user.isSuperAdmin
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  registerOrg,
  login,
  logout
};
