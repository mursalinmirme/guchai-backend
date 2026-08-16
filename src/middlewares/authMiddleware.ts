import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
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
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
    return;
  }
};
