"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.signIn = exports.signUp = void 0;
const User_1 = require("../models/User");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || "fallback_secret", {
        expiresIn: "30d",
    });
};
const signUp = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: "Please provide email and password" });
            return;
        }
        const userExists = await User_1.User.findOne({ email });
        if (userExists) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const user = await User_1.User.create({
            email,
            password: hashedPassword,
        });
        if (user) {
            res.status(201).json({
                user: {
                    id: user._id,
                    email: user.email,
                },
                token: generateToken(user._id),
            });
            return;
        }
        else {
            res.status(400).json({ message: "Invalid user data" });
            return;
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.signUp = signUp;
const signIn = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email });
        if (user && (await bcryptjs_1.default.compare(password, user.password))) {
            res.json({
                user: {
                    id: user._id,
                    email: user.email,
                },
                token: generateToken(user._id),
            });
            return;
        }
        else {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.signIn = signIn;
const getMe = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id).select("-password");
        if (user) {
            res.json({ user: { id: user._id, email: user.email } });
            return;
        }
        res.status(404).json({ message: "User not found" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getMe = getMe;
