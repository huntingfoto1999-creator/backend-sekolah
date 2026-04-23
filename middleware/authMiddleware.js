const jwt = require("jsonwebtoken");

function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1];
}

function authRequired(req, res, next) {
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.status(401).json({
      message: "Akses ditolak, token tidak ditemukan"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Token tidak valid atau sudah expired"
    });
  }
}

function roleRequired(...roles) {
  return (req, res, next) => {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        message: "Akses ditolak, token tidak ditemukan"
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!roles.includes(decoded.role)) {
        return res.status(403).json({
          message: "Anda tidak punya akses"
        });
      }

      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({
        message: "Token tidak valid atau sudah expired"
      });
    }
  };
}

module.exports = {
  authRequired,
  roleRequired
};