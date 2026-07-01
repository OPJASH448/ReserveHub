const { checkResourceAccess, defaultRankComparator } = require('../src/middleware/auth');

describe('RBAC Middleware - Injected Strategy Pattern', () => {
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

  describe('Default Rank Strategy (rank <= maxAllowedRank)', () => {
    it('should allow access if user rank is less than required rank', () => {
      req.user = { rank: 1, isSuperAdmin: false };
      const middleware = checkResourceAccess(2); // required is 2, user is 1 (higher authority)
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access if user rank matches required rank exactly', () => {
      req.user = { rank: 2, isSuperAdmin: false };
      const middleware = checkResourceAccess(2);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access if user rank is greater than required rank', () => {
      req.user = { rank: 3, isSuperAdmin: false };
      const middleware = checkResourceAccess(2); // user rank 3 is lower authority than 2
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: Insufficient authority' });
    });
  });

  describe('Custom Strategy Injection', () => {
    it('should support strict equality strategy (only allow rank === required)', () => {
      const strictEqualsStrategy = (userRank, requiredRank) => userRank === requiredRank;
      const middleware = checkResourceAccess(2, strictEqualsStrategy);

      // Try with rank 1 (which would be allowed in default strategy but denied in strict equals)
      req.user = { rank: 1, isSuperAdmin: false };
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: Insufficient authority' });

      // Reset mock and try with rank 2
      next.mockReset();
      req.user = { rank: 2, isSuperAdmin: false };
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should support inverted strategy (only allow rank >= required, e.g. for low-privileged resources)', () => {
      const invertedStrategy = (userRank, requiredRank) => userRank >= requiredRank;
      const middleware = checkResourceAccess(2, invertedStrategy);

      // Rank 1 should be denied
      req.user = { rank: 1, isSuperAdmin: false };
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();

      // Rank 3 should be allowed
      next.mockReset();
      req.user = { rank: 3, isSuperAdmin: false };
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('General Guard Conditions', () => {
    it('should bypass all checks for SuperAdmin', () => {
      req.user = { rank: null, isSuperAdmin: true };
      const middleware = checkResourceAccess(0); // Highest restriction
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access if user object is not present', () => {
      req.user = undefined;
      const middleware = checkResourceAccess(2);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should deny access if user rank is null or undefined', () => {
      req.user = { rank: null, isSuperAdmin: false };
      const middleware = checkResourceAccess(2);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied: No role assigned' });
    });
  });
});
