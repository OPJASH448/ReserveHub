const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SuperAdmin = require('../models/SuperAdmin');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access_secret_12345';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, ACCESS_TOKEN_SECRET, async (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired access token' });

    try {
      let user;
      if (payload.isSuperAdmin) {
        user = await SuperAdmin.findById(payload.userId);
      } else {
        user = await User.findById(payload.userId).populate('roleLevelId');
      }

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      if (!payload.isSuperAdmin && user.status !== 'active') {
        return res.status(403).json({ error: 'User account is not active' });
      }

      req.user = {
        userId: user._id,
        orgId: payload.isSuperAdmin ? null : user.orgId,
        roleLevelId: (!payload.isSuperAdmin && user.roleLevelId) ? user.roleLevelId._id : null,
        rank: (!payload.isSuperAdmin && user.roleLevelId) ? user.roleLevelId.rank : null,
        isSuperAdmin: !!payload.isSuperAdmin
      };
      next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'Internal server authentication error' });
    }
  });
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Access denied: SuperAdmin only' });
  }
  next();
};

const requireOrgAdmin = (req, res, next) => {
  if (!req.user || req.user.rank !== 0) {
    return res.status(403).json({ error: 'Access denied: OrgAdmin (rank 0) only' });
  }
  next();
};

const defaultRankComparator = (userRank, requiredRank) => {
  if (userRank === null || userRank === undefined) return false;
  return userRank <= requiredRank;
};

/**
 * Dynamic RBAC check. Compares numeric user rank against resource maxAllowedRank.
 * By default, uses defaultRankComparator (checks if user rank is <= requiredRank).
 * Supports injected custom comparator strategies.
 */
const checkResourceAccess = (maxAllowedRank, comparator = defaultRankComparator) => {
  return (req, res, next) => {
    if (req.user && req.user.isSuperAdmin) return next(); // Bypass for SuperAdmin
    
    if (!req.user || req.user.rank === null || req.user.rank === undefined) {
      return res.status(403).json({ error: 'Access denied: No role assigned' });
    }

    if (comparator(req.user.rank, maxAllowedRank)) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied: Insufficient authority' });
    }
  };
};

module.exports = {
  authenticateToken,
  requireSuperAdmin,
  requireOrgAdmin,
  checkResourceAccess,
  defaultRankComparator
};
