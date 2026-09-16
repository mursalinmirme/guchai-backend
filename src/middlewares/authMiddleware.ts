import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query?.token && typeof req.query.token === "string") {
    // Fallback: allow token via query param for SSE (EventSource cannot set custom headers)
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      res.status(401).json({ message: "Not authorized, user not found" });
      return;
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
    return;
  }
};
