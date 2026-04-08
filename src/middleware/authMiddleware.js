const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || "mysecretkey";

module.exports = (req, res, next) => {
  let token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  // Handle "Bearer <token>" format
  if (token.startsWith('Bearer ')) {
    token = token.slice(7, token.length);
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};