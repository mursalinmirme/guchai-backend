import { Request, Response } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middlewares/authMiddleware";

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
  });
};

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Please provide email and password" });
      return;
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        user: {
          id: user._id,
          email: user.email,
        },
        token: generateToken(user._id as string),
      });
      return;
    } else {
      res.status(400).json({ message: "Invalid user data" });
      return;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        user: {
          id: user._id,
          email: user.email,
        },
        token: generateToken(user._id as string),
      });
      return;
    } else {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (user) {
      res.json({ user: { id: user._id, email: user.email } });
      return;
    }
    res.status(404).json({ message: "User not found" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
