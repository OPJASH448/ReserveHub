const User = require('../models/User');
const RoleLevel = require('../models/RoleLevel');

/**
 * Finds all active users eligible to resolve a given Join Request.
 * Resolvers are active users in the same organization whose role is the parent of the requested role.
 * 
 * @param {Object} joinRequest - The JoinRequest document or object containing orgId and requestedRoleLevelId
 * @returns {Promise<Array>} - List of User documents
 */
async function findResolversForJoinRequest(joinRequest) {
  const roleLevel = await RoleLevel.findById(joinRequest.requestedRoleLevelId);
  if (!roleLevel) {
    throw new Error('Requested RoleLevel not found');
  }

  // If there is no parent, it's rank 0 (OrgAdmin). In this case, SuperAdmin approves the Org registration,
  // which auto-assigns the creator as OrgAdmin. There is no standard join request resolver for rank 0.
  if (!roleLevel.parentRoleLevelId) {
    return [];
  }

  // Find all active users in the same org who hold the parent role
  return await User.find({
    orgId: joinRequest.orgId,
    roleLevelId: roleLevel.parentRoleLevelId,
    status: 'active'
  });
}

module.exports = { findResolversForJoinRequest };
