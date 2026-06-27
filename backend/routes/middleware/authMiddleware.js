import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// Rutele protejate primesc utilizatorul curent din JWT in req.user.
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: "Token lipsa" });

  const token = authHeader.split(" ")[1];
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalid" });
  }
};
