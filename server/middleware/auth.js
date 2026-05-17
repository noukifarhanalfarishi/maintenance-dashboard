const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'maint-dashboard-dev-secret-2024';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    const msg = e.name === 'TokenExpiredError'
      ? 'Session kadaluarsa, silakan login kembali'
      : 'Token tidak valid';
    res.status(401).json({ error: msg });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Akses ditolak: memerlukan role ${roles.join(' / ')}` });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
