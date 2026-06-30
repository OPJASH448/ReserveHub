const User = require('../models/User');
const RoleLevel = require('../models/RoleLevel');

/**
 * Resolves the active users who are eligible to handle a join request for a role level,
 * walking up the rank hierarchy (CoR) if intermediate levels do not have active users.
 * 
 * @param {string|ObjectId} orgId - The organization ID
 * @param {string|ObjectId} requestedRoleLevelId - The requested RoleLevel ID
 * @returns {Promise<Array>} - List of eligible active User documents
 */
async function resolveRoleLevel(orgId, requestedRoleLevelId) {
  let currentRoleId = requestedRoleLevelId;

  while (currentRoleId) {
    const roleLevel = await RoleLevel.findById(currentRoleId);
    if (!roleLevel) {
      throw new Error('RoleLevel not found');
    }

    const parentRoleId = roleLevel.parentRoleLevelId;
    if (!parentRoleId) {
      // Reached the root level (rank 0 / OrgAdmin level)
      if (currentRoleId.toString() === requestedRoleLevelId.toString()) {
        // If the requested role is the root itself, there are no parent levels to route to.
        return [];
      }
      // Return any active users at the root level (OrgAdmin)
      return await User.find({
        orgId,
        roleLevelId: currentRoleId,
        status: 'active'
      });
    }

    // Check if there are active users for this parent role level
    const activeUsers = await User.find({
      orgId,
      roleLevelId: parentRoleId,
      status: 'active'
    });

    if (activeUsers.length > 0) {
      return activeUsers;
    }

    // Walk up the Chain of Responsibility
    currentRoleId = parentRoleId;
  }

  return [];
}

/**
 * Finds all active users eligible to resolve a given Join Request.
 * Resolvers are active users in the same organization whose role is the parent of the requested role,
 * or resolved higher up the CoR chain.
 * 
 * @param {Object} joinRequest - The JoinRequest document or object containing orgId and requestedRoleLevelId
 * @returns {Promise<Array>} - List of User documents
 */
async function findResolversForJoinRequest(joinRequest) {
  return await resolveRoleLevel(joinRequest.orgId, joinRequest.requestedRoleLevelId);
}

module.exports = {
  resolveRoleLevel,
  findResolversForJoinRequest
};
