const { checkResourceAccess } = require('../src/middleware/auth');

describe('RBAC Middleware (Numeric Rank Comparison)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  const runMiddleware = (maxAllowedRank, userPayload) => {
    req.user = userPayload;
    const middleware = checkResourceAccess(maxAllowedRank);
    middleware(req, res, next);
  };

  describe('Fabricated 5-Level Hierarchy (Rank 0 is highest, Rank 4 is lowest)', () => {
    const resourceMaxAllowedRank = 2; // Ranks 0, 1, 2 should have access. Ranks 3, 4 should be denied.

    it('should ALLOW access to Rank 0 (highest authority)', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: 0, isSuperAdmin: false });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should ALLOW access to Rank 1', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: 1, isSuperAdmin: false });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should ALLOW access to Rank 2 (exactly matching the limit)', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: 2, isSuperAdmin: false });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should DENY access to Rank 3 (below authority threshold)', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: 3, isSuperAdmin: false });
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: Insufficient authority' });
    });

    it('should DENY access to Rank 4 (lowest authority)', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: 4, isSuperAdmin: false });
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: Insufficient authority' });
    });

    it('should ALLOW access to SuperAdmin regardless of rank (bypass check)', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: null, isSuperAdmin: true });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should DENY access if user has no assigned rank/role', () => {
      runMiddleware(resourceMaxAllowedRank, { rank: null, isSuperAdmin: false });
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: No role assigned' });
    });
  });
});
