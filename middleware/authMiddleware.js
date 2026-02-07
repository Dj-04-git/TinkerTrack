import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded; // Store user data from token in request
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
